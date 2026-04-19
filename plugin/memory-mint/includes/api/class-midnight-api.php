<?php
namespace MemoryMint\Api;

use MemoryMint\Helpers\Encryption;
use MemoryMint\Services\MidnightService;

if (!defined('ABSPATH')) {
    exit;
}

class MidnightApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/midnight/(?P<keepsake_id>\d+)/prove', [
            'methods'             => 'POST',
            'callback'            => [$this, 'prove'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'proof_type'       => [
                    'required' => true,
                    'type'     => 'string',
                    'enum'     => ['ownership', 'content_authentic', 'created_before', 'contains_tag'],
                ],
                'cutoff_timestamp' => ['required' => false, 'type' => 'integer'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/midnight/(?P<keepsake_id>\d+)/transfer', [
            'methods'             => 'POST',
            'callback'            => [$this, 'transfer'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'recipient' => ['required' => true, 'type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/midnight/(?P<keepsake_id>\d+)/revoke', [
            'methods'             => 'POST',
            'callback'            => [$this, 'revoke'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/prove
     * Generate a ZK proof for a memory attribute without revealing the data.
     */
    public function prove(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $proof_type  = sanitize_text_field($request->get_param('proof_type'));

        global $wpdb;
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}memorymint_keepsakes WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->midnight_status !== 'minted' || empty($keepsake->midnight_address)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Keepsake has not been registered on Midnight yet.',
            ], 400);
        }

        $midnight = new MidnightService();
        if (!$midnight->is_configured()) {
            return new \WP_REST_Response([
                'success' => false,
                'code'    => 'midnight_not_configured',
                'error'   => 'Midnight sidecar not configured.',
            ], 503);
        }

        $mnemonic = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($mnemonic)) {
            return new \WP_REST_Response(['success' => false, 'error' => $mnemonic->get_error_message()], 400);
        }

        $cutoff = null;
        if ($proof_type === 'created_before') {
            $cutoff = intval($request->get_param('cutoff_timestamp'));
            if ($cutoff <= 0) {
                return new \WP_REST_Response([
                    'success' => false,
                    'error'   => 'cutoff_timestamp is required for created_before proofs.',
                ], 400);
            }
        }

        @set_time_limit(360);

        $result = $midnight->prove_memory($mnemonic, $keepsake->midnight_address, $proof_type, $cutoff);

        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic);
        }

        if (!$result['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => $result['error']], 500);
        }

        return new \WP_REST_Response([
            'success' => true,
            'proof'   => [
                'verified'   => true,
                'proof_type' => $proof_type,
                'tx_id'      => $result['tx_id'],
                'proved_at'  => gmdate('c'),
            ],
        ], 200);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/transfer
     * Transfer Midnight private record to another MemoryMint account.
     * Both sender and recipient must be custodial (email) accounts with active mnemonics.
     */
    public function transfer(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $recipient   = sanitize_email($request->get_param('recipient'));

        if (!is_email($recipient)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid recipient email.'], 400);
        }

        if (strtolower($recipient) === strtolower($user->user_email)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Cannot transfer to yourself.'], 400);
        }

        global $wpdb;
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}memorymint_keepsakes WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->midnight_status !== 'minted' || empty($keepsake->midnight_address)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Keepsake has not been registered on Midnight yet.',
            ], 400);
        }

        $midnight = new MidnightService();
        if (!$midnight->is_configured()) {
            return new \WP_REST_Response([
                'success' => false,
                'code'    => 'midnight_not_configured',
                'error'   => 'Midnight sidecar not configured.',
            ], 503);
        }

        $recipient_user = get_user_by('email', $recipient);
        if (!$recipient_user) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Recipient is not a registered MemoryMint user.',
            ], 404);
        }

        $user_mnemonic = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($user_mnemonic)) {
            return new \WP_REST_Response(['success' => false, 'error' => $user_mnemonic->get_error_message()], 400);
        }

        $recipient_mnemonic = $this->get_user_mnemonic($recipient_user->ID);
        if (is_wp_error($recipient_mnemonic)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Recipient account does not support Midnight transfers. '
                           . 'They must be a custodial (email-based) MemoryMint account with an active seed phrase.',
            ], 400);
        }

        @set_time_limit(360);

        $result = $midnight->transfer_memory(
            $user_mnemonic,
            $recipient_mnemonic,
            $keepsake->midnight_address
        );

        if (function_exists('sodium_memzero')) {
            sodium_memzero($user_mnemonic);
            sodium_memzero($recipient_mnemonic);
        }

        if (!$result['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => $result['error']], 500);
        }

        $wpdb->update(
            $wpdb->prefix . 'memorymint_keepsakes',
            ['user_id' => $recipient_user->ID],
            ['id' => $keepsake_id]
        );

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/revoke
     * Permanently revoke the Midnight private record. Irreversible.
     */
    public function revoke(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));

        global $wpdb;
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}memorymint_keepsakes WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->midnight_status !== 'minted' || empty($keepsake->midnight_address)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Keepsake has not been registered on Midnight yet.',
            ], 400);
        }

        $midnight = new MidnightService();
        if (!$midnight->is_configured()) {
            return new \WP_REST_Response([
                'success' => false,
                'code'    => 'midnight_not_configured',
                'error'   => 'Midnight sidecar not configured.',
            ], 503);
        }

        $mnemonic = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($mnemonic)) {
            return new \WP_REST_Response(['success' => false, 'error' => $mnemonic->get_error_message()], 400);
        }

        @set_time_limit(360);

        $result = $midnight->revoke_memory($mnemonic, $keepsake->midnight_address);

        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic);
        }

        if (!$result['success']) {
            return new \WP_REST_Response(['success' => false, 'error' => $result['error']], 500);
        }

        $wpdb->update(
            $wpdb->prefix . 'memorymint_keepsakes',
            ['midnight_status' => 'revoked'],
            ['id' => $keepsake_id]
        );

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * Retrieve and decrypt the authenticated user's BIP-39 mnemonic.
     * Returns WP_Error if the mnemonic is unavailable (self-custody user or decrypt failure).
     */
    private function get_user_mnemonic(int $user_id) {
        $enc = get_user_meta($user_id, 'memorymint_custodial_mnemonic_encrypted', true);
        if (empty($enc)) {
            return new \WP_Error(
                'mnemonic_unavailable',
                'Your seed phrase is no longer held by the server. '
                . 'Server-assisted Midnight operations require a custodial (email) account with an active seed phrase.'
            );
        }

        $mnemonic = Encryption::decrypt($enc);
        if (!$mnemonic) {
            return new \WP_Error('mnemonic_decrypt_failed', 'Failed to decrypt wallet credentials.');
        }

        return $mnemonic;
    }

    public function check_auth(\WP_REST_Request $request) {
        $auth_api = new AuthApi();
        return $auth_api->check_auth($request);
    }
}
