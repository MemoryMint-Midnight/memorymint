<?php
namespace MemoryMint\Cron;

use MemoryMint\Helpers\Encryption;
use MemoryMint\Services\MidnightService;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * H7 — Cardano↔Midnight reconciliation cron.
 *
 * Runs every 20 minutes (custom WP Cron interval) and retries any keepsake
 * whose midnight_status = 'failed'. Exponential backoff per keepsake; after
 * MAX_RETRIES attempts the status is set to 'failed_permanent'.
 *
 * Retry state is stored in wp_options per keepsake to avoid a DB migration.
 * Self-custody users (mnemonic deleted after seed backup) are skipped — they
 * must complete Midnight registration via the DApp Connector.
 */
class MidnightReconciliation {

    // Backoff delays indexed by 0-based attempt number (after the initial failure)
    private const RETRY_DELAYS = [
        0 => 20 * MINUTE_IN_SECONDS,   // 1st retry: 20 min
        1 =>  1 * HOUR_IN_SECONDS,      // 2nd retry: 1 hour
        2 =>  4 * HOUR_IN_SECONDS,      // 3rd retry: 4 hours
        3 => 24 * HOUR_IN_SECONDS,      // 4th retry: 24 hours
        4 => 48 * HOUR_IN_SECONDS,      // 5th retry: 48 hours
    ];
    private const MAX_RETRIES = 5;

    public function run(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $keepsakes = $wpdb->get_results(
            "SELECT * FROM `$table` WHERE `midnight_status` = 'failed'"
        );

        foreach ($keepsakes as $keepsake) {
            $this->retry_keepsake($keepsake);
        }
    }

    private function retry_keepsake(object $keepsake): void {
        global $wpdb;
        $table   = $wpdb->prefix . 'memorymint_keepsakes';
        $opt_key = 'memorymint_mid_retry_' . $keepsake->id;

        $state = get_option($opt_key, ['count' => 0, 'next_retry' => 0]);

        // Exceeded max retries — mark permanent failure and clean up state
        if ($state['count'] >= self::MAX_RETRIES) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update($table, ['midnight_status' => 'failed_permanent'], ['id' => $keepsake->id]);
            delete_option($opt_key);
            return;
        }

        // Backoff period hasn't elapsed yet
        if (time() < $state['next_retry']) {
            return;
        }

        // Self-custody users have no server-side mnemonic — skip silently
        $encrypted_mnemonic = get_user_meta((int) $keepsake->user_id, 'memorymint_custodial_mnemonic_encrypted', true);
        if (empty($encrypted_mnemonic)) {
            return;
        }

        $mnemonic = Encryption::decrypt($encrypted_mnemonic);
        if (!$mnemonic) {
            return;
        }

        $midnight = new MidnightService();
        if (!$midnight->is_configured()) {
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

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update($table, ['midnight_status' => 'minting'], ['id' => $keepsake->id]);

        $result = $midnight->mint_memory(
            $mnemonic,
            $keepsake->content_hash,
            (int) strtotime($keepsake->created_at),
            $keepsake->geo_hash ?? MidnightService::ZERO_BYTES32,
            (int) ($keepsake->tag_count ?? 0),
            $cardano_asset_id
        );

        if (function_exists('sodium_memzero')) {
            sodium_memzero($mnemonic);
        }

        if ($result['success']) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update($table, [
                'midnight_status'  => 'minted',
                'midnight_address' => $result['contract_address'],
            ], ['id' => $keepsake->id]);
            delete_option($opt_key);
            return;
        }

        // Failed — schedule next retry with backoff
        $new_count = $state['count'] + 1;
        if ($new_count >= self::MAX_RETRIES) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update($table, ['midnight_status' => 'failed_permanent'], ['id' => $keepsake->id]);
            delete_option($opt_key);
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update($table, ['midnight_status' => 'failed'], ['id' => $keepsake->id]);
            $delay = self::RETRY_DELAYS[$new_count] ?? (48 * HOUR_IN_SECONDS);
            update_option($opt_key, ['count' => $new_count, 'next_retry' => time() + $delay], false);
        }
    }
}
