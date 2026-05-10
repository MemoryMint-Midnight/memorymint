<?php
namespace MemoryMint;

if (!defined('ABSPATH')) {
    exit;
}

class Deactivator {

    public function deactivate() {
        wp_clear_scheduled_hook('memorymint_wallet_balance_check');
        wp_clear_scheduled_hook('memorymint_midnight_reconciliation');
        wp_clear_scheduled_hook('memorymint_run_midn_job');
        flush_rewrite_rules();

        // Only drop tables if cleanup option is enabled
        if (get_option('memorymint_delete_data_on_deactivate', false)) {
            $this->drop_tables();
            $this->remove_options();
            $this->remove_roles();
        }
    }

    private function drop_tables() {
        global $wpdb;

        $tables = [
            $wpdb->prefix . 'memorymint_keepsakes',
            $wpdb->prefix . 'memorymint_share_links',
            $wpdb->prefix . 'memorymint_transactions',
            $wpdb->prefix . 'memorymint_policy_wallets',
        ];

        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS $table");
        }
    }

    private function remove_options() {
        $options = [
            'memorymint_db_version',
            'memorymint_network',
            'memorymint_service_fee',
            'memorymint_merchant_address',
            'memorymint_anvil_api_key_preprod',
            'memorymint_anvil_api_key_mainnet',
            'memorymint_production_url',
            'memorymint_max_image_size',
            'memorymint_max_video_size',
            'memorymint_max_audio_size',
            'memorymint_delete_data_on_deactivate',
            'memorymint_wallet_alert_email',
        ];

        foreach ($options as $option) {
            delete_option($option);
        }
    }

    private function remove_roles() {
        remove_role('keepsake_owner');
        remove_role('memory_collector');
        remove_role('memory_founder');
    }
}
