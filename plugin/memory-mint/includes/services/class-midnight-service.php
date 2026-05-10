<?php
namespace MemoryMint\Services;

if (!defined('ABSPATH')) {
    exit;
}

class MidnightService {

    private string $sidecar_url;
    private string $api_secret;

    // Zero bytes — used when geoHash or cardanoAssetId is absent.
    const ZERO_BYTES32 = '0000000000000000000000000000000000000000000000000000000000000000';

    public function __construct() {
        $this->sidecar_url = rtrim(get_option('memorymint_midnight_sidecar_url', ''), '/');
        $this->api_secret  = get_option('memorymint_midnight_api_secret', '');
    }

    public function is_configured(): bool {
        return !empty($this->sidecar_url) && !empty($this->api_secret);
    }

    /**
     * Call POST /api/v1/midnight/mint on the sidecar.
     *
     * All hash fields must be exactly 64 hex chars (32 bytes).
     * contentHash    = SHA-256 of the raw file bytes (hash_file('sha256', path))
     * geoHash        = SHA-256 of the geohash string, or ZERO_BYTES32 if absent
     * cardanoAssetId = SHA-256 of (policyId_bytes ++ assetName_bytes), or ZERO_BYTES32 for private keepsakes
     *
     * Returns: ['success' => bool, 'contract_address' => string, 'error' => string]
     */
    public function mint_memory(
        string $user_mnemonic,
        string $content_hash,
        int    $timestamp,
        string $geo_hash,
        int    $tag_count,
        string $cardano_asset_id
    ): array {
        if (!$this->is_configured()) {
            return ['success' => false, 'error' => 'Midnight sidecar not configured.'];
        }

        if (!$this->is_hex32($content_hash)) {
            return ['success' => false, 'error' => 'contentHash must be a 64-char hex string.'];
        }

        $geo_hash        = $this->coerce_hex32($geo_hash);
        $cardano_asset_id = $this->coerce_hex32($cardano_asset_id);

        $payload = json_encode([
            'userMnemonic'   => $user_mnemonic,
            'contentHash'    => $content_hash,
            'timestamp'      => $timestamp,
            'geoHash'        => $geo_hash,
            'tagCount'       => $tag_count,
            'cardanoAssetId' => $cardano_asset_id,
        ]);

        // Midnight mints can take several minutes on a cold sidecar start.
        // PHP max_execution_time must be set to at least 360 for this to succeed.
        $response = wp_remote_post($this->sidecar_url . '/api/v1/midnight/mint', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-api-secret' => $this->api_secret,
            ],
            'body'    => $payload,
            'timeout' => 300,
        ]);

        if (is_wp_error($response)) {
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200) {
            $err = is_array($body) ? ($body['error'] ?? "HTTP $code") : "HTTP $code";
            return ['success' => false, 'error' => $err];
        }

        $addr = is_array($body) ? ($body['contractAddress'] ?? '') : '';

        if (empty($addr)) {
            return ['success' => false, 'error' => 'Sidecar returned no contract address.'];
        }

        return ['success' => true, 'contract_address' => $addr];
    }

    /**
     * Call POST /api/v1/midnight/:addr/prove on the sidecar.
     *
     * Returns: ['success' => bool, 'tx_id' => string, 'error' => string]
     */
    public function prove_memory(
        string $user_mnemonic,
        string $contract_address,
        string $proof_type,
        ?int   $cutoff_timestamp
    ): array {
        if (!$this->is_configured()) {
            return ['success' => false, 'error' => 'Midnight sidecar not configured.'];
        }

        $payload = ['proofType' => $proof_type, 'userMnemonic' => $user_mnemonic];
        if ($proof_type === 'created_before' && $cutoff_timestamp !== null) {
            $payload['cutoffTimestamp'] = $cutoff_timestamp;
        }

        $response = wp_remote_post(
            $this->sidecar_url . '/api/v1/midnight/' . rawurlencode($contract_address) . '/prove',
            [
                'headers' => ['Content-Type' => 'application/json', 'x-api-secret' => $this->api_secret],
                'body'    => json_encode($payload),
                'timeout' => 300,
            ]
        );

        if (is_wp_error($response)) {
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200) {
            $err = is_array($body) ? ($body['error'] ?? "HTTP $code") : "HTTP $code";
            return ['success' => false, 'error' => $err];
        }

        return ['success' => true, 'tx_id' => is_array($body) ? ($body['txId'] ?? '') : ''];
    }

    /**
     * Call POST /api/v1/midnight/:addr/transfer on the sidecar.
     *
     * The new owner's mnemonic is never transmitted. Instead, the 32-byte Midnight
     * secret key is derived here (BIP-39 seed → HMAC-SHA256) and sent as hex.
     * The sidecar computes the on-chain commitment from that sk.
     *
     * Returns: ['success' => bool, 'tx_hash' => string, 'error' => string]
     */
    public function transfer_memory(
        string $user_mnemonic,
        string $new_owner_mnemonic,
        string $contract_address
    ): array {
        if (!$this->is_configured()) {
            return ['success' => false, 'error' => 'Midnight sidecar not configured.'];
        }

        $new_owner_sk = self::derive_midnight_sk($new_owner_mnemonic);

        $response = wp_remote_post(
            $this->sidecar_url . '/api/v1/midnight/' . rawurlencode($contract_address) . '/transfer',
            [
                'headers' => ['Content-Type' => 'application/json', 'x-api-secret' => $this->api_secret],
                'body'    => json_encode(['userMnemonic' => $user_mnemonic, 'newOwnerSecretKey' => $new_owner_sk]),
                'timeout' => 300,
            ]
        );

        if (is_wp_error($response)) {
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200) {
            $err = is_array($body) ? ($body['error'] ?? "HTTP $code") : "HTTP $code";
            return ['success' => false, 'error' => $err];
        }

        return ['success' => true, 'tx_hash' => is_array($body) ? ($body['txHash'] ?? '') : ''];
    }

    /**
     * Call POST /api/v1/midnight/:addr/revoke on the sidecar.
     *
     * Returns: ['success' => bool, 'tx_hash' => string, 'error' => string]
     */
    public function revoke_memory(
        string $user_mnemonic,
        string $contract_address
    ): array {
        if (!$this->is_configured()) {
            return ['success' => false, 'error' => 'Midnight sidecar not configured.'];
        }

        $response = wp_remote_post(
            $this->sidecar_url . '/api/v1/midnight/' . rawurlencode($contract_address) . '/revoke',
            [
                'headers' => ['Content-Type' => 'application/json', 'x-api-secret' => $this->api_secret],
                'body'    => json_encode(['userMnemonic' => $user_mnemonic]),
                'timeout' => 300,
            ]
        );

        if (is_wp_error($response)) {
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200) {
            $err = is_array($body) ? ($body['error'] ?? "HTTP $code") : "HTTP $code";
            return ['success' => false, 'error' => $err];
        }

        return ['success' => true, 'tx_hash' => is_array($body) ? ($body['txHash'] ?? '') : ''];
    }

    /**
     * Hash a Cardano asset into the 32-byte hex form the sidecar expects.
     * cardanoAssetId = SHA-256( policyId_bytes ++ assetName_bytes )
     */
    public static function hash_cardano_asset(string $policy_id_hex, string $asset_name): string {
        if (empty($policy_id_hex) || strlen($policy_id_hex) % 2 !== 0) {
            return self::ZERO_BYTES32;
        }
        return hash('sha256', hex2bin($policy_id_hex) . $asset_name);
    }

    /**
     * Hash a geo string into 32-byte hex (SHA-256).
     */
    public static function hash_geo(string $geo): string {
        if (empty($geo)) {
            return self::ZERO_BYTES32;
        }
        return hash('sha256', $geo);
    }

    /**
     * Derive the 32-byte Midnight secret key from a BIP-39 mnemonic.
     * Mirrors deriveUserSecretKey() in provider.ts:
     *   seed = PBKDF2-SHA512(password=mnemonic, salt='mnemonic', iter=2048, len=64)
     *   sk   = HMAC-SHA256(key='memorymint:midnight:sk:v1', data=seed)
     * Returns 64-char lowercase hex.
     */
    private static function derive_midnight_sk(string $mnemonic): string {
        $seed = hash_pbkdf2('sha512', $mnemonic, 'mnemonic', 2048, 64, true);
        $sk   = hash_hmac('sha256', $seed, 'memorymint:midnight:sk:v1', true);
        return bin2hex($sk);
    }

    private function is_hex32(string $v): bool {
        return strlen($v) === 64 && ctype_xdigit($v);
    }

    private function coerce_hex32(string $v): string {
        return $this->is_hex32($v) ? $v : self::ZERO_BYTES32;
    }
}
