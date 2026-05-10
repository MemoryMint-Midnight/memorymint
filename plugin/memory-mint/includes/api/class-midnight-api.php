<?php
namespace MemoryMint\Api;

use MemoryMint\Helpers\Encryption;
use MemoryMint\Services\MidnightService;
use MemoryMint\Cron\MidnightJobs;

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

        // Async status endpoints
        register_rest_route(self::NAMESPACE, '/midnight/(?P<keepsake_id>\d+)/status', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_midnight_status'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/midnight/job/(?P<job_id>[0-9a-f]{24})', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_job_status'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/prove
     *
     * Queues a ZK-proof job and returns 202 immediately.
     * Frontend polls GET /midnight/job/{job_id} for the result.
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

        // Fail fast: verify mnemonic is available before queueing (avoids a job that
        // is guaranteed to fail; we can return a useful error immediately).
        $mnemonic_check = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($mnemonic_check)) {
            return new \WP_REST_Response(['success' => false, 'error' => $mnemonic_check->get_error_message()], 400);
        }
        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic_check);
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

        $args = [
            'midnight_address' => $keepsake->midnight_address,
            'proof_type'       => $proof_type,
        ];
        if ($cutoff !== null) {
            $args['cutoff'] = $cutoff;
        }

        $job_id = MidnightJobs::queue($user->ID, $keepsake_id, 'prove', $args);

        return new \WP_REST_Response([
            'success' => true,
            'queued'  => true,
            'job_id'  => $job_id,
        ], 202);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/transfer
     *
     * Queues a Midnight ownership transfer and returns 202 immediately.
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

        // Fail fast: verify both mnemonics are available before queueing.
        $sender_mnemonic = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($sender_mnemonic)) {
            return new \WP_REST_Response(['success' => false, 'error' => $sender_mnemonic->get_error_message()], 400);
        }
        if (function_exists('sodium_memzero')) {
            sodium_memzero($sender_mnemonic);
        }

        $recipient_mnemonic = $this->get_user_mnemonic($recipient_user->ID);
        if (is_wp_error($recipient_mnemonic)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Recipient account does not support Midnight transfers. '
                           . 'They must be a custodial (email-based) MemoryMint account with an active seed phrase.',
            ], 400);
        }
        if (function_exists('sodium_memzero')) {
            sodium_memzero($recipient_mnemonic);
        }

        $job_id = MidnightJobs::queue($user->ID, $keepsake_id, 'transfer', [
            'midnight_address'   => $keepsake->midnight_address,
            'recipient_user_id'  => $recipient_user->ID,
        ]);

        return new \WP_REST_Response([
            'success' => true,
            'queued'  => true,
            'job_id'  => $job_id,
        ], 202);
    }

    /**
     * POST /memorymint/v1/midnight/{id}/revoke
     *
     * Queues a Midnight record revocation and returns 202 immediately.
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

        $mnemonic_check = $this->get_user_mnemonic($user->ID);
        if (is_wp_error($mnemonic_check)) {
            return new \WP_REST_Response(['success' => false, 'error' => $mnemonic_check->get_error_message()], 400);
        }
        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic_check);
        }

        $job_id = MidnightJobs::queue($user->ID, $keepsake_id, 'revoke', [
            'midnight_address' => $keepsake->midnight_address,
        ]);

        return new \WP_REST_Response([
            'success' => true,
            'queued'  => true,
            'job_id'  => $job_id,
        ], 202);
    }

    /**
     * GET /memorymint/v1/midnight/{id}/status
     *
     * Returns midnight_status and midnight_address from the keepsake row.
     * Used by the frontend to poll Midnight mint progress.
     */
    public function get_midnight_status(\WP_REST_Request $request) {
        $user        = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));

        global $wpdb;
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT id, midnight_status, midnight_address FROM {$wpdb->prefix}memorymint_keepsakes WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        return new \WP_REST_Response([
            'success'          => true,
            'midnight_status'  => $keepsake->midnight_status,
            'midnight_address' => $keepsake->midnight_address ?: null,
        ], 200);
    }

    /**
     * GET /memorymint/v1/midnight/job/{job_id}
     *
     * Returns async job status. Only the job owner can poll.
     * Frontend polls this after receiving 202 from prove/transfer/revoke/mint.
     *
     * Response shape:
     *   { status: 'queued'|'running'|'done'|'failed', result?: {...}, error?: string }
     */
    public function get_job_status(\WP_REST_Request $request) {
        $user   = wp_get_current_user();
        $job_id = sanitize_text_field($request->get_param('job_id'));

        $job = MidnightJobs::get($job_id);

        if (!$job) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Job not found or expired.'], 404);
        }

        // Only the user who queued the job may poll its status.
        if ((int) $job['user_id'] !== $user->ID) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Forbidden.'], 403);
        }

        $response = [
            'success'    => true,
            'job_id'     => $job_id,
            'status'     => $job['status'],
            'operation'  => $job['operation'],
            'created_at' => $job['created_at'],
            'updated_at' => $job['updated_at'],
        ];

        if ($job['status'] === 'done') {
            $response['result'] = $job['result'];
        } elseif ($job['status'] === 'failed') {
            $response['error'] = $job['error'];
        }

        return new \WP_REST_Response($response, 200);
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
