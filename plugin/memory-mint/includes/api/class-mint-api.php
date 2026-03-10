<?php
namespace MemoryMint\Api;

use MemoryMint\MemoryMint;
use MemoryMint\Helpers\Encryption;
use MemoryMint\Services\AnvilService;

if (!defined('ABSPATH')) {
    exit;
}

class MintApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/mint/build', [
            'methods' => 'POST',
            'callback' => [$this, 'build_transaction'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'keepsake_id' => ['required' => true, 'type' => 'integer'],
                'batch_count' => ['required' => false, 'type' => 'integer', 'default' => 1],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/mint/sign', [
            'methods' => 'POST',
            'callback' => [$this, 'sign_and_submit'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'keepsake_id' => ['required' => true, 'type' => 'integer'],
                'witness' => ['required' => true, 'type' => 'string'],
                'unsigned_tx' => ['required' => true, 'type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/mint/custodial-sign', [
            'methods' => 'POST',
            'callback' => [$this, 'custodial_sign'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'keepsake_id' => ['required' => true, 'type' => 'integer'],
                'unsigned_tx' => ['required' => true, 'type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/mint/price', [
            'methods' => 'GET',
            'callback' => [$this, 'get_price'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/mint/status/(?P<tx_hash>[a-f0-9]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'check_status'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/mint/retry/(?P<keepsake_id>\d+)', [
            'methods' => 'POST',
            'callback' => [$this, 'retry_mint'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/mint/wallet-balance', [
            'methods' => 'GET',
            'callback' => [$this, 'get_wallet_balance'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * Return the ADA balance of the authenticated user's custodial wallet.
     * Non-custodial users receive success=false (they hold their own funds).
     */
    public function get_wallet_balance(\WP_REST_Request $request) {
        $user = wp_get_current_user();

        $is_custodial = get_user_meta($user->ID, 'memorymint_is_custodial', true);
        if (!$is_custodial) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Not a custodial user.'], 400);
        }

        $wallet_address = get_user_meta($user->ID, 'memorymint_wallet_address', true);
        if (!$wallet_address) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No wallet address found.'], 400);
        }

        $anvil   = new AnvilService();
        $balance = $anvil->get_address_balance($wallet_address);

        if ($balance === null) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Could not fetch balance.'], 502);
        }

        return new \WP_REST_Response([
            'success'     => true,
            'balance_ada' => $balance,
            'address'     => $wallet_address,
        ], 200);
    }

    /**
     * Build an unsigned minting transaction via Anvil API.
     */
    public function build_transaction(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->mint_status === 'minted') {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake is already minted.'], 400);
        }

        // Auto-unstick keepsakes that got abandoned mid-flow (stuck in 'minting' > 2 minutes).
        if ($keepsake->mint_status === 'minting') {
            $stuck_threshold = strtotime('-2 minutes');
            $updated_at      = strtotime($keepsake->updated_at ?? $keepsake->created_at);
            if ($updated_at > $stuck_threshold) {
                return new \WP_REST_Response([
                    'success' => false,
                    'error'   => 'A mint is already in progress for this keepsake. Please wait a moment and retry.',
                ], 409);
            }
            // Older than 2 min — treat as failed and allow a fresh build.
            $wpdb->update($table, ['mint_status' => 'failed'], ['id' => $keepsake_id]);
            $keepsake->mint_status = 'failed';
        }

        // Get the active policy wallet
        $wallet_table = $wpdb->prefix . 'memorymint_policy_wallets';
        $network = MemoryMint::get_network();
        $policy_wallet = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $wallet_table WHERE network = %s AND is_active = 1 LIMIT 1",
            $network
        ));

        if (!$policy_wallet) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No active policy wallet. Admin must generate one.'], 500);
        }

        // Get user's wallet address
        $user_wallet = get_user_meta($user->ID, 'memorymint_wallet_address', true);
        if (!$user_wallet) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No wallet address linked to your account. Connect a wallet first.'], 400);
        }

        // Get ADA price and calculate fees
        $anvil = new AnvilService();
        $ada_price = $anvil->get_ada_price();

        if (!$ada_price) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Unable to fetch ADA price.'], 500);
        }

        $batch_count     = max(1, intval($request->get_param('batch_count') ?? 1));
        $service_fee_usd = MemoryMint::get_service_fee($keepsake->file_type ?? 'image', $batch_count);
        $service_fee_ada = round($service_fee_usd / $ada_price, 6);
        $merchant_address = MemoryMint::get_merchant_address();

        if (!$merchant_address) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Merchant wallet not configured. Contact admin.'], 500);
        }

        // Build CIP-25 metadata
        $asset_name = $this->generate_asset_name($keepsake);
        $metadata = [
            'name' => $keepsake->title,
            'description' => $keepsake->description ?: '',
            'image' => $keepsake->file_url,
            'mediaType' => $this->get_media_type($keepsake->file_type),
            'creator' => 'Memory Mint',
            'timestamp' => strtotime($keepsake->created_at),
            'privacy' => $keepsake->privacy,
        ];

        // Custodial (email) users pay for their own mints — the policy wallet only
        // co-signs as minting authority. Check they have enough ADA before building.
        $is_custodial_user = (bool) get_user_meta($user->ID, 'memorymint_is_custodial', true);

        if ($is_custodial_user) {
            $balance = $anvil->get_address_balance($user_wallet);
            // Only block when we have a definitive balance (null = API unavailable, let Anvil surface the error)
            if ($balance !== null && $balance < 2.5) {
                return new \WP_REST_Response([
                    'success' => false,
                    'error'   => sprintf(
                        'Your wallet has %.2f ADA — you need at least 2.5 ADA to cover the mint. Send ADA to your wallet address: %s',
                        $balance,
                        $user_wallet
                    ),
                ], 400);
            }
        }

        $tx_params = [
            'user_address'         => $user_wallet,
            'merchant_address'     => $merchant_address,
            'service_fee_lovelace' => intval($service_fee_ada * 1000000),
            'policy_keyhash'       => $policy_wallet->payment_keyhash,
            'policy_id'            => $policy_wallet->policy_id ?: $policy_wallet->payment_keyhash,
            'policy_json'          => $policy_wallet->policy_json,
            'asset_name'           => $asset_name,
            'metadata'             => $metadata,
        ];
        // No fee_payer_address — users fund their own mints.

        // Build transaction via Anvil API
        $tx_result = $anvil->build_mint_transaction($tx_params);

        if (!$tx_result['success']) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Failed to build transaction: ' . ($tx_result['error'] ?? 'Unknown error'),
            ], 500);
        }

        // Update keepsake status
        $wpdb->update($table, ['mint_status' => 'minting'], ['id' => $keepsake_id]);

        // Replay protection: store a fingerprint of the unsigned TX so sign endpoints
        // can verify the caller is submitting exactly the TX we built — not a crafted one.
        // Also store the computed fee so sign endpoints log the correct (batch-aware) amount.
        set_transient(
            'memorymint_pending_tx_' . $keepsake_id . '_' . $user->ID,
            ['hash' => hash('sha256', $tx_result['unsigned_tx']), 'fee_usd' => $service_fee_usd],
            10 * MINUTE_IN_SECONDS
        );

        return new \WP_REST_Response([
            'success' => true,
            'unsigned_tx' => $tx_result['unsigned_tx'],
            'fee_breakdown' => [
                'service_fee_usd' => $service_fee_usd,
                'service_fee_ada' => $service_fee_ada,
                'ada_price_usd' => $ada_price,
                'estimated_network_fee_ada' => $tx_result['network_fee'] ?? 0.2,
            ],
        ], 200);
    }

    /**
     * Validate that a CBOR hex transaction string looks structurally sound.
     * Returns true if valid, false otherwise.
     */
    private function validate_tx_hex(string $tx_hex): bool {
        // Must be a non-empty hex string
        if (empty($tx_hex) || !ctype_xdigit($tx_hex)) {
            return false;
        }
        // Must be even-length (whole bytes)
        if (strlen($tx_hex) % 2 !== 0) {
            return false;
        }
        // Cardano transactions are typically 200–100,000 bytes; reject obviously bad sizes
        $byte_len = strlen($tx_hex) / 2;
        if ($byte_len < 100 || $byte_len > 100000) {
            return false;
        }
        // First byte of a CBOR-encoded Cardano tx should be a CBOR array (0x84 or 0x83)
        $first_byte = hexdec(substr($tx_hex, 0, 2));
        if ($first_byte !== 0x84 && $first_byte !== 0x83) {
            return false;
        }
        return true;
    }

    /**
     * Receive customer signature, add policy signature, and submit to blockchain.
     */
    public function sign_and_submit(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $customer_witness = sanitize_text_field($request->get_param('witness'));
        $unsigned_tx = sanitize_text_field($request->get_param('unsigned_tx'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->mint_status === 'minted') {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake is already minted.'], 400);
        }

        if (!$this->validate_tx_hex($unsigned_tx)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid transaction data. Please try building the transaction again.'], 400);
        }

        // Replay protection: ensure the submitted TX matches the one built for this keepsake.
        $transient_key   = 'memorymint_pending_tx_' . $keepsake_id . '_' . $user->ID;
        $transient_data  = get_transient($transient_key);
        $stored_hash     = is_array($transient_data) ? ($transient_data['hash'] ?? '') : '';
        $stored_fee_usd  = is_array($transient_data) ? ($transient_data['fee_usd'] ?? null) : null;
        if (!$stored_hash || !hash_equals($stored_hash, hash('sha256', $unsigned_tx))) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Transaction mismatch. Please start the minting process again.',
            ], 400);
        }
        $logged_fee_usd = $stored_fee_usd ?? MemoryMint::get_service_fee($keepsake->file_type ?? 'image');

        // Get policy wallet and decrypt signing key
        $wallet_table = $wpdb->prefix . 'memorymint_policy_wallets';
        $network = MemoryMint::get_network();
        $policy_wallet = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $wallet_table WHERE network = %s AND is_active = 1 LIMIT 1",
            $network
        ));

        if (!$policy_wallet) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No active policy wallet.'], 500);
        }

        // Decrypt the signing key
        $skey = Encryption::decrypt($policy_wallet->skey_encrypted);
        if (!$skey) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Failed to decrypt policy wallet key.'], 500);
        }

        // Sign with policy wallet using PHP-Cardano
        $sign_result = \CardanoTransactionSignerPHP::signTransaction($unsigned_tx, $skey);

        if (!$sign_result['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Policy wallet signing failed.'], 500);
        }

        // Submit: pass the ORIGINAL unsigned tx as base so Anvil merges both
        // witness sets cleanly — avoids the duplicate policy witness that would
        // result from using the already-policy-signed tx as the base.
        $anvil = new AnvilService();
        $submit_result = $anvil->submit_transaction([
            'signed_tx'        => $unsigned_tx,
            'customer_witness' => $customer_witness,
            'policy_witness'   => $sign_result['witnessSetHex'],
        ]);

        // Clear sensitive data
        if (function_exists('sodium_memzero')) {
            sodium_memzero($skey);
        }

        $tx_table = $wpdb->prefix . 'memorymint_transactions';

        if (!$submit_result['success']) {
            $wpdb->update($table, ['mint_status' => 'failed'], ['id' => $keepsake_id]);
            delete_transient($transient_key);

            $wpdb->insert($tx_table, [
                'user_id'        => $user->ID,
                'keepsake_id'    => $keepsake_id,
                'tx_type'        => 'mint',
                'service_fee_usd' => $logged_fee_usd,
                'network'        => $network,
                'status'         => 'failed',
                'error_message'  => substr($submit_result['error'] ?? 'Unknown error', 0, 1000),
            ]);

            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Transaction submission failed: ' . ($submit_result['error'] ?? 'Unknown error'),
            ], 500);
        }

        $tx_hash = $submit_result['tx_hash'];

        // Update keepsake with minting data
        $wpdb->update($table, [
            'mint_status' => 'minted',
            'tx_hash' => $tx_hash,
            'asset_id' => $submit_result['asset_id'] ?? '',
            'policy_id' => $policy_wallet->policy_id,
            'service_fee_paid' => $logged_fee_usd,
        ], ['id' => $keepsake_id]);

        // Record the transaction
        $wpdb->insert($tx_table, [
            'user_id' => $user->ID,
            'keepsake_id' => $keepsake_id,
            'tx_hash' => $tx_hash,
            'tx_type' => 'mint',
            'service_fee_usd' => $logged_fee_usd,
            'network' => $network,
            'status' => 'confirmed',
        ]);

        delete_transient($transient_key);

        return new \WP_REST_Response([
            'success' => true,
            'tx_hash' => $tx_hash,
            'asset_id' => $submit_result['asset_id'] ?? '',
            'explorer_url' => $this->get_explorer_url($tx_hash, $network),
        ], 200);
    }

    /**
     * Server-side sign and submit for email users with custodial wallets.
     * Decrypts the user's custodial signing key, signs with it, then co-signs
     * with the policy wallet and submits — no browser wallet needed.
     */
    public function custodial_sign(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $unsigned_tx = sanitize_text_field($request->get_param('unsigned_tx'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->mint_status === 'minted') {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake is already minted.'], 400);
        }

        if (!$this->validate_tx_hex($unsigned_tx)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid transaction data. Please try building the transaction again.'], 400);
        }

        // Guard: only email (custodial) users should reach this endpoint.
        if (!get_user_meta($user->ID, 'memorymint_is_custodial', true)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'No custodial wallet found. Please use browser wallet signing instead.',
            ], 400);
        }

        // Replay protection: ensure the submitted TX matches the one built for this keepsake.
        $transient_key  = 'memorymint_pending_tx_' . $keepsake_id . '_' . $user->ID;
        $transient_data = get_transient($transient_key);
        $stored_hash    = is_array($transient_data) ? ($transient_data['hash'] ?? '') : '';
        $stored_fee_usd = is_array($transient_data) ? ($transient_data['fee_usd'] ?? null) : null;
        if (!$stored_hash || !hash_equals($stored_hash, hash('sha256', $unsigned_tx))) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Transaction mismatch. Please start the minting process again.',
            ], 400);
        }
        $logged_fee_usd = $stored_fee_usd ?? MemoryMint::get_service_fee($keepsake->file_type ?? 'image');

        // Users fund their own mints. The custodial skey signs to authorise spending
        // their UTXOs; the policy wallet co-signs as minting authority (native script).
        // If the skey was deleted at backup time the user must use a browser wallet.
        $custodial_skey_enc = get_user_meta($user->ID, 'memorymint_custodial_skey_encrypted', true);
        if (empty($custodial_skey_enc)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Your seed phrase has been backed up and the server key removed. '
                           . 'Please import your seed phrase into a Cardano wallet app and connect it here to mint.',
            ], 400);
        }

        $custodial_skey = Encryption::decrypt($custodial_skey_enc);
        if (!$custodial_skey) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Failed to decrypt custodial wallet key.'], 500);
        }

        $custodial_sign = \CardanoTransactionSignerPHP::signTransaction($unsigned_tx, $custodial_skey);

        if (function_exists('sodium_memzero')) {
            sodium_memzero($custodial_skey);
        }

        if (!$custodial_sign['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Custodial wallet signing failed.'], 500);
        }

        $wallet_table  = $wpdb->prefix . 'memorymint_policy_wallets';
        $network       = MemoryMint::get_network();
        $policy_wallet = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $wallet_table WHERE network = %s AND is_active = 1 LIMIT 1",
            $network
        ));

        if (!$policy_wallet) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No active policy wallet.'], 500);
        }

        $policy_skey = Encryption::decrypt($policy_wallet->skey_encrypted);
        if (!$policy_skey) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Failed to decrypt policy wallet key.'], 500);
        }

        $policy_sign = \CardanoTransactionSignerPHP::signTransaction($unsigned_tx, $policy_skey);

        if (function_exists('sodium_memzero')) {
            sodium_memzero($policy_skey);
        }

        if (!$policy_sign['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Policy wallet signing failed.'], 500);
        }

        // Submit with both witnesses: custodial key (UTXO spending) + policy key (minting auth).
        $anvil = new AnvilService();
        $submit_result = $anvil->submit_transaction([
            'signed_tx' => $unsigned_tx,
            'witnesses' => [$custodial_sign['witnessSetHex'], $policy_sign['witnessSetHex']],
        ]);

        $tx_table = $wpdb->prefix . 'memorymint_transactions';

        if (!$submit_result['success']) {
            $wpdb->update($table, ['mint_status' => 'failed'], ['id' => $keepsake_id]);
            delete_transient($transient_key);

            $wpdb->insert($tx_table, [
                'user_id'        => $user->ID,
                'keepsake_id'    => $keepsake_id,
                'tx_type'        => 'mint',
                'service_fee_usd' => $logged_fee_usd,
                'network'        => $network,
                'status'         => 'failed',
                'error_message'  => substr($submit_result['error'] ?? 'Unknown error', 0, 1000),
            ]);

            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Transaction submission failed: ' . ($submit_result['error'] ?? 'Unknown error'),
            ], 500);
        }

        $tx_hash = $submit_result['tx_hash'];

        // Update keepsake
        $wpdb->update($table, [
            'mint_status'      => 'minted',
            'tx_hash'          => $tx_hash,
            'asset_id'         => $submit_result['asset_id'] ?? '',
            'policy_id'        => $policy_wallet->policy_id,
            'service_fee_paid' => $logged_fee_usd,
        ], ['id' => $keepsake_id]);

        // Record transaction
        $wpdb->insert($tx_table, [
            'user_id'        => $user->ID,
            'keepsake_id'    => $keepsake_id,
            'tx_hash'        => $tx_hash,
            'tx_type'        => 'mint',
            'service_fee_usd' => $logged_fee_usd,
            'network'        => $network,
            'status'         => 'confirmed',
        ]);

        delete_transient($transient_key);

        return new \WP_REST_Response([
            'success'      => true,
            'tx_hash'      => $tx_hash,
            'asset_id'     => $submit_result['asset_id'] ?? '',
            'explorer_url' => $this->get_explorer_url($tx_hash, $network),
        ], 200);
    }

    /**
     * Get current minting price information.
     * Returns per-type fees so the frontend can compute the correct total
     * when a user uploads a mix of images, videos, and audio files.
     */
    public function get_price(\WP_REST_Request $request) {
        $anvil     = new AnvilService();
        $ada_price = $anvil->get_ada_price();

        $fees_by_type = [];
        foreach (['image', 'video', 'audio'] as $type) {
            $unit_usd  = MemoryMint::get_service_fee($type, 1);
            $batch_usd = MemoryMint::get_service_fee($type, 5); // per-keepsake rate in a batch of 5
            $fees_by_type[$type] = [
                'usd'       => $unit_usd,
                'ada'       => $ada_price ? round($unit_usd / $ada_price, 6) : null,
                'batch_usd' => $batch_usd * 5,                  // total batch price for display
                'batch_per_usd' => $batch_usd,                  // per-keepsake fee when batching
                'batch_per_ada' => $ada_price ? round($batch_usd / $ada_price, 6) : null,
            ];
        }

        // Backwards-compatible top-level fields (image fee as default)
        $image_fee_usd = $fees_by_type['image']['usd'];
        $image_fee_ada = $ada_price ? round($image_fee_usd / $ada_price, 6) : null;

        return new \WP_REST_Response([
            'success'                  => true,
            'fees_by_type'             => $fees_by_type,
            'service_fee_usd'          => $image_fee_usd,
            'service_fee_ada'          => $image_fee_ada,
            'ada_price_usd'            => $ada_price,
            'estimated_network_fee_ada' => 0.2,
            'network'                  => MemoryMint::get_network(),
        ], 200);
    }

    /**
     * Check the minting status of a transaction.
     */
    public function check_status(\WP_REST_Request $request) {
        $tx_hash = sanitize_text_field($request->get_param('tx_hash'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_transactions';

        $tx = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE tx_hash = %s",
            $tx_hash
        ));

        if (!$tx) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Transaction not found.'], 404);
        }

        return new \WP_REST_Response([
            'success' => true,
            'tx_hash' => $tx->tx_hash,
            'status' => $tx->status,
            'tx_type' => $tx->tx_type,
            'network' => $tx->network,
            'explorer_url' => $this->get_explorer_url($tx->tx_hash, $tx->network),
            'created_at' => $tx->created_at,
        ], 200);
    }

    /**
     * Reset a failed keepsake back to 'pending' so the user can attempt another mint.
     * Only the keepsake owner can call this, and only for 'failed' status.
     */
    public function retry_mint(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));

        global $wpdb;
        $table    = $wpdb->prefix . 'memorymint_keepsakes';
        $tx_table = $wpdb->prefix . 'memorymint_transactions';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->mint_status === 'minted') {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake is already minted — no retry needed.'], 400);
        }

        if (!in_array($keepsake->mint_status, ['failed', 'minting'], true)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Only failed mints can be retried.'], 400);
        }

        // Reset keepsake to pending
        $wpdb->update($table, ['mint_status' => 'pending', 'tx_hash' => null, 'asset_id' => null], ['id' => $keepsake_id]);

        // Mark any stuck pending transaction records as failed so they don't pollute history
        $wpdb->update($tx_table, ['status' => 'failed'], ['keepsake_id' => $keepsake_id, 'status' => 'pending']);

        // Clear any stale TX fingerprint so the next build starts fresh.
        delete_transient('memorymint_pending_tx_' . $keepsake_id . '_' . $user->ID);

        return new \WP_REST_Response([
            'success'    => true,
            'message'    => 'Keepsake reset to pending. You can now retry minting.',
            'keepsake_id' => $keepsake_id,
        ], 200);
    }

    private function generate_asset_name($keepsake) {
        $clean = preg_replace('/[^a-zA-Z0-9]/', '', $keepsake->title);
        $clean = substr($clean, 0, 32);
        return 'MemoryMint' . $clean . $keepsake->id;
    }

    private function get_media_type($file_type) {
        $map = [
            'image' => 'image/png',
            'video' => 'video/mp4',
            'audio' => 'audio/mpeg',
        ];
        return $map[$file_type] ?? 'image/png';
    }

    private function get_explorer_url($tx_hash, $network) {
        $base = $network === 'mainnet'
            ? 'https://cardanoscan.io'
            : 'https://preprod.cardanoscan.io';
        return $base . '/transaction/' . $tx_hash;
    }

    public function check_auth(\WP_REST_Request $request) {
        $auth_api = new AuthApi();
        return $auth_api->check_auth($request);
    }
}
