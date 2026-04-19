<?php
namespace MemoryMint;

if (!defined('ABSPATH')) {
    exit;
}

class Activator {

    public function activate() {
        $this->create_tables();
        $this->set_default_options();
        flush_rewrite_rules();
    }

    private function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // Keepsakes table
        $table_keepsakes = $wpdb->prefix . 'memorymint_keepsakes';
        $sql_keepsakes = "CREATE TABLE $table_keepsakes (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            title varchar(100) NOT NULL,
            description text DEFAULT NULL,
            privacy enum('public','shared','private') NOT NULL DEFAULT 'public',
            keepsake_type enum('standard','private') NOT NULL DEFAULT 'standard',
            file_attachment_id bigint(20) unsigned DEFAULT NULL,
            file_type varchar(10) DEFAULT NULL,
            file_url text DEFAULT NULL,
            thumbnail_url text DEFAULT NULL,
            file_size bigint(20) unsigned DEFAULT 0,
            content_hash varchar(64) DEFAULT NULL,
            is_encrypted tinyint(1) unsigned NOT NULL DEFAULT 0,
            geo_hash varchar(64) DEFAULT NULL,
            tag_count tinyint unsigned NOT NULL DEFAULT 0,
            tx_hash varchar(128) DEFAULT NULL,
            asset_id varchar(128) DEFAULT NULL,
            policy_id varchar(64) DEFAULT NULL,
            mint_status enum('pending','minting','minted','failed') NOT NULL DEFAULT 'pending',
            midnight_address varchar(128) DEFAULT NULL,
            midnight_status enum('pending','minting','minted','failed','skipped','revoked') NOT NULL DEFAULT 'pending',
            service_fee_paid decimal(10,2) DEFAULT 0.00,
            network_fee_ada decimal(20,6) DEFAULT 0.000000,
            wallet_address varchar(128) DEFAULT NULL,
            metadata_json text DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY privacy (privacy),
            KEY mint_status (mint_status),
            KEY midnight_status (midnight_status),
            KEY tx_hash (tx_hash)
        ) $charset_collate;";

        dbDelta($sql_keepsakes);

        // Share links table
        $table_shares = $wpdb->prefix . 'memorymint_share_links';
        $sql_shares = "CREATE TABLE $table_shares (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            keepsake_id bigint(20) unsigned NOT NULL,
            share_token varchar(64) NOT NULL,
            share_type enum('link','email') NOT NULL DEFAULT 'link',
            recipient_email varchar(255) DEFAULT NULL,
            created_by bigint(20) unsigned NOT NULL,
            expires_at datetime DEFAULT NULL,
            accessed_count int(11) unsigned NOT NULL DEFAULT 0,
            is_active tinyint(1) NOT NULL DEFAULT 1,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY share_token (share_token),
            KEY keepsake_id (keepsake_id),
            KEY created_by (created_by)
        ) $charset_collate;";

        dbDelta($sql_shares);

        // Transactions table
        $table_transactions = $wpdb->prefix . 'memorymint_transactions';
        $sql_transactions = "CREATE TABLE $table_transactions (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            keepsake_id bigint(20) unsigned DEFAULT NULL,
            tx_hash varchar(128) DEFAULT NULL,
            tx_type enum('mint','payment','refund') NOT NULL DEFAULT 'mint',
            amount_ada decimal(20,6) DEFAULT 0.000000,
            service_fee_usd decimal(10,2) DEFAULT 0.00,
            network varchar(20) NOT NULL DEFAULT 'preprod',
            status enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
            error_message text DEFAULT NULL,
            raw_cbor text DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY keepsake_id (keepsake_id),
            KEY tx_hash (tx_hash),
            KEY status (status)
        ) $charset_collate;";

        dbDelta($sql_transactions);

        // Policy wallets table
        $table_wallets = $wpdb->prefix . 'memorymint_policy_wallets';
        $sql_wallets = "CREATE TABLE $table_wallets (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            wallet_name varchar(100) NOT NULL,
            mnemonic_encrypted text NOT NULL,
            skey_encrypted text NOT NULL,
            payment_address varchar(128) NOT NULL,
            payment_keyhash varchar(64) NOT NULL,
            stake_address varchar(128) DEFAULT NULL,
            policy_json text DEFAULT NULL,
            policy_id varchar(64) DEFAULT NULL,
            network varchar(20) NOT NULL DEFAULT 'preprod',
            is_active tinyint(1) NOT NULL DEFAULT 1,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY network (network),
            KEY is_active (is_active)
        ) $charset_collate;";

        dbDelta($sql_wallets);

        // Albums table
        $table_albums = $wpdb->prefix . 'memorymint_albums';
        $sql_albums = "CREATE TABLE $table_albums (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(100) NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id)
        ) $charset_collate;";

        dbDelta($sql_albums);

        // Album–keepsake pivot table
        $table_album_keepsakes = $wpdb->prefix . 'memorymint_album_keepsakes';
        $sql_album_keepsakes = "CREATE TABLE $table_album_keepsakes (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            album_id bigint(20) unsigned NOT NULL,
            keepsake_id bigint(20) unsigned NOT NULL,
            added_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY album_keepsake (album_id, keepsake_id),
            KEY album_id (album_id),
            KEY keepsake_id (keepsake_id)
        ) $charset_collate;";

        dbDelta($sql_album_keepsakes);

        // Store DB version for future migrations
        update_option('memorymint_db_version', MEMORYMINT_VERSION);
    }

    private function set_default_options() {
        add_option('memorymint_network', 'preprod');
        add_option('memorymint_service_fee_image', '2.50');
        add_option('memorymint_service_fee_video', '5.00');
        add_option('memorymint_service_fee_audio', '2.50');
        add_option('memorymint_service_fee_image_batch', '10.00');
        add_option('memorymint_service_fee_video_batch', '20.00');
        add_option('memorymint_service_fee_audio_batch', '10.00');
        add_option('memorymint_merchant_address', '');
        add_option('memorymint_anvil_api_key_preprod', '');
        add_option('memorymint_anvil_api_key_mainnet', '');
        add_option('memorymint_production_url', '');
        add_option('memorymint_midnight_sidecar_url', '');
        add_option('memorymint_midnight_api_secret', '');
        add_option('memorymint_max_image_size', '10485760');  // 10MB
        add_option('memorymint_max_video_size', '52428800');  // 50MB
        add_option('memorymint_max_audio_size', '10485760');  // 10MB
    }
}
