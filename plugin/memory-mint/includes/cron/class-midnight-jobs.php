<?php
namespace MemoryMint\Cron;

use MemoryMint\Helpers\Encryption;
use MemoryMint\Services\MidnightService;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Async job queue for long-running Midnight sidecar operations.
 *
 * prove/transfer/revoke/mint each take 8–15 minutes in the sidecar. That blows
 * past Nginx's fastcgi_read_timeout (typically 60 s) and the PHP max_execution_time
 * set by the host, killing the response before the sidecar finishes.
 *
 * Fix: the REST endpoint queues a job here and returns 202 immediately. WP Cron
 * fires 'memorymint_run_midn_job' in a separate process that can run for the full
 * duration. The frontend polls GET /memorymint/v1/midnight/job/{job_id} for status.
 *
 * IMPORTANT — VPS production setup: run wp-cron via the system scheduler rather
 * than the default WP loopback (which also has a 60 s Nginx timeout):
 *
 *   1. Add to wp-config.php: define( 'DISABLE_WP_CRON', true );
 *   2. Add to crontab:  * * * * * wp cron event run --due-now --path=/var/www/html
 *
 * With that in place each job is picked up within ~60 seconds and runs without
 * any HTTP-layer timeout.
 */
class MidnightJobs {

    const OPTION_PREFIX = 'memorymint_midnjob_';
    const RESULT_TTL    = 30 * MINUTE_IN_SECONDS; // keep result available after completion

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Queue a new job and schedule a WP Cron single event.
     * Returns the 24-char hex job ID — callers forward this to the frontend.
     *
     * @param int    $user_id     WP user who owns this job
     * @param int    $keepsake_id Related keepsake
     * @param string $operation   prove | transfer | revoke | mint
     * @param array  $args        Operation-specific arguments (NO decrypted secrets)
     */
    public static function queue(int $user_id, int $keepsake_id, string $operation, array $args = []): string {
        $job_id = bin2hex(random_bytes(12));
        $job    = [
            'id'          => $job_id,
            'user_id'     => $user_id,
            'keepsake_id' => $keepsake_id,
            'operation'   => $operation,
            'args'        => $args,
            'status'      => 'queued',
            'result'      => null,
            'error'       => null,
            'created_at'  => time(),
            'updated_at'  => time(),
            'expires_at'  => 0,
        ];
        update_option(self::OPTION_PREFIX . $job_id, $job, false);
        wp_schedule_single_event(time(), 'memorymint_run_midn_job', [$job_id]);
        // Best-effort: spawn the cron runner immediately so the first poll doesn't
        // need to wait for the next organic HTTP request to trigger wp-cron.
        // This is a no-op when DISABLE_WP_CRON is true (system cron handles it).
        if (function_exists('spawn_cron')) {
            spawn_cron();
        }
        return $job_id;
    }

    /**
     * Retrieve job data by ID.  Returns null when the job doesn't exist or has expired.
     */
    public static function get(string $job_id): ?array {
        $job = get_option(self::OPTION_PREFIX . $job_id, null);
        if (!is_array($job)) {
            return null;
        }
        // Remove expired completed/failed jobs so wp_options doesn't grow unbounded
        if ($job['expires_at'] > 0 && time() > $job['expires_at']) {
            delete_option(self::OPTION_PREFIX . $job_id);
            return null;
        }
        return $job;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cron runner — hooked to 'memorymint_run_midn_job'
    // ─────────────────────────────────────────────────────────────────────────

    public static function run(string $job_id): void {
        $job = self::get($job_id);
        if (!$job || $job['status'] !== 'queued') {
            return;
        }

        self::save(array_merge($job, ['status' => 'running', 'updated_at' => time()]));

        $midnight = new MidnightService();
        if (!$midnight->is_configured()) {
            self::fail($job, 'Midnight sidecar not configured.');
            return;
        }

        $enc      = get_user_meta((int) $job['user_id'], 'memorymint_custodial_mnemonic_encrypted', true);
        $mnemonic = $enc ? Encryption::decrypt($enc) : null;
        if (!$mnemonic) {
            self::fail($job, 'Failed to decrypt wallet credentials.');
            return;
        }

        switch ($job['operation']) {
            case 'prove':
                self::run_prove($job, $midnight, $mnemonic);
                break;
            case 'transfer':
                self::run_transfer($job, $midnight, $mnemonic);
                break;
            case 'revoke':
                self::run_revoke($job, $midnight, $mnemonic);
                break;
            case 'mint':
                self::run_mint($job, $midnight, $mnemonic);
                break;
            default:
                self::fail($job, 'Unknown operation: ' . esc_html($job['operation']));
        }

        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Operation handlers
    // ─────────────────────────────────────────────────────────────────────────

    private static function run_prove(array $job, MidnightService $midnight, string $mnemonic): void {
        $args   = $job['args'];
        $result = $midnight->prove_memory(
            $mnemonic,
            $args['midnight_address'],
            $args['proof_type'],
            isset($args['cutoff']) ? (int) $args['cutoff'] : null
        );

        if (!$result['success']) {
            self::fail($job, $result['error']);
            return;
        }

        self::done($job, [
            'proof_type' => $args['proof_type'],
            'tx_id'      => $result['tx_id'],
            'verified'   => true,
            'proved_at'  => gmdate('c'),
        ]);
    }

    private static function run_transfer(array $job, MidnightService $midnight, string $mnemonic): void {
        $args          = $job['args'];
        $recipient_enc = get_user_meta((int) $args['recipient_user_id'], 'memorymint_custodial_mnemonic_encrypted', true);
        $recipient_mn  = $recipient_enc ? Encryption::decrypt($recipient_enc) : null;

        if (!$recipient_mn) {
            self::fail($job, 'Failed to decrypt recipient wallet credentials.');
            return;
        }

        $result = $midnight->transfer_memory($mnemonic, $recipient_mn, $args['midnight_address']);

        if (function_exists('sodium_memzero')) {
            sodium_memzero($recipient_mn);
        }

        if (!$result['success']) {
            self::fail($job, $result['error']);
            return;
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'memorymint_keepsakes',
            ['user_id' => (int) $args['recipient_user_id']],
            ['id'      => (int) $job['keepsake_id']]
        );

        self::done($job, []);
    }

    private static function run_revoke(array $job, MidnightService $midnight, string $mnemonic): void {
        $result = $midnight->revoke_memory($mnemonic, $job['args']['midnight_address']);

        if (!$result['success']) {
            self::fail($job, $result['error']);
            return;
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'memorymint_keepsakes',
            ['midnight_status' => 'revoked'],
            ['id'              => (int) $job['keepsake_id']]
        );

        self::done($job, []);
    }

    private static function run_mint(array $job, MidnightService $midnight, string $mnemonic): void {
        global $wpdb;
        $table    = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsake = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", (int) $job['keepsake_id']));

        if (!$keepsake) {
            self::fail($job, 'Keepsake not found.');
            return;
        }

        $keepsake_type    = $keepsake->keepsake_type ?? 'standard';
        $cardano_asset_id = MidnightService::ZERO_BYTES32;
        if ($keepsake_type === 'standard' && !empty($keepsake->policy_id)) {
            $clean            = substr(preg_replace('/[^a-zA-Z0-9]/', '', $keepsake->title ?? ''), 0, 32);
            $cardano_asset_id = MidnightService::hash_cardano_asset(
                $keepsake->policy_id,
                'MemoryMint' . $clean . $keepsake->id
            );
        }

        $wpdb->update($table, ['midnight_status' => 'minting'], ['id' => (int) $job['keepsake_id']]);

        $result = $midnight->mint_memory(
            $mnemonic,
            $keepsake->content_hash,
            (int) strtotime($keepsake->created_at),
            $keepsake->geo_hash ?? MidnightService::ZERO_BYTES32,
            (int) ($keepsake->tag_count ?? 0),
            $cardano_asset_id
        );

        if (!$result['success']) {
            $wpdb->update($table, ['midnight_status' => 'failed'], ['id' => (int) $job['keepsake_id']]);
            self::fail($job, $result['error']);
            return;
        }

        $wpdb->update($table, [
            'midnight_status'  => 'minted',
            'midnight_address' => $result['contract_address'],
        ], ['id' => (int) $job['keepsake_id']]);

        self::done($job, ['midnight_address' => $result['contract_address']]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static function done(array $job, array $result): void {
        self::save(array_merge($job, [
            'status'     => 'done',
            'result'     => $result,
            'error'      => null,
            'updated_at' => time(),
            'expires_at' => time() + self::RESULT_TTL,
        ]));
    }

    private static function fail(array $job, string $error): void {
        self::save(array_merge($job, [
            'status'     => 'failed',
            'error'      => $error,
            'updated_at' => time(),
            'expires_at' => time() + self::RESULT_TTL,
        ]));
    }

    private static function save(array $job): void {
        update_option(self::OPTION_PREFIX . $job['id'], $job, false);
    }
}
