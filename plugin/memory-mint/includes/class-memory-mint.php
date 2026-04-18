<?php
namespace MemoryMint;

if (!defined('ABSPATH')) {
    exit;
}

class MemoryMint {

    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public function init() {
        // Register custom roles
        $this->register_roles();

        // Run any pending DB migrations (fast no-op when already up to date)
        add_action('admin_init', [$this, 'maybe_run_migrations']);

        // Load admin
        if (is_admin()) {
            new Admin\AdminPage();
        }

        // Load REST API endpoints
        add_action('rest_api_init', [$this, 'register_api_routes']);

        // CORS support for Next.js
        add_action('rest_api_init', [$this, 'enable_cors']);
        add_action('init', [$this, 'enable_cors']);

        // Policy wallet balance alert cron
        if (!wp_next_scheduled('memorymint_wallet_balance_check')) {
            wp_schedule_event(time(), 'twicedaily', 'memorymint_wallet_balance_check');
        }
        add_action('memorymint_wallet_balance_check', [$this, 'check_policy_wallet_balance']);
    }

    public function register_roles() {
        // Only add roles if they don't exist yet
        if (!get_role('keepsake_owner')) {
            add_role('keepsake_owner', 'Keepsake Owner', [
                'read' => true,
                'upload_files' => true,
                'memorymint_view_gallery' => true,
                'memorymint_share_keepsakes' => true,
            ]);
        }

        if (!get_role('memory_collector')) {
            add_role('memory_collector', 'Memory Collector', [
                'read' => true,
                'upload_files' => true,
                'memorymint_view_gallery' => true,
                'memorymint_share_keepsakes' => true,
                'memorymint_collector_badge' => true,
            ]);
        }

        if (!get_role('memory_founder')) {
            add_role('memory_founder', 'Memory Founder', [
                'read' => true,
                'upload_files' => true,
                'memorymint_view_gallery' => true,
                'memorymint_share_keepsakes' => true,
                'memorymint_collector_badge' => true,
                'memorymint_founder_access' => true,
            ]);
        }

        // Add capabilities to subscriber role (default for new users)
        $subscriber = get_role('subscriber');
        if ($subscriber) {
            $subscriber->add_cap('upload_files');
        }
    }

    public function register_api_routes() {
        $auth_api = new Api\AuthApi();
        $auth_api->register_routes();

        $upload_api = new Api\UploadApi();
        $upload_api->register_routes();

        $keepsake_api = new Api\KeepsakeApi();
        $keepsake_api->register_routes();

        $mint_api = new Api\MintApi();
        $mint_api->register_routes();

        $gallery_api = new Api\GalleryApi();
        $gallery_api->register_routes();

        $share_api = new Api\ShareApi();
        $share_api->register_routes();

        $album_api = new Api\AlbumApi();
        $album_api->register_routes();
    }

    public function enable_cors() {
        $allowed_origins = apply_filters('memorymint_cors_origins', [
            'http://localhost:3000',
            'http://localhost:3001',
        ]);

        // Add production origin from settings
        $production_url = get_option('memorymint_production_url', '');
        if ($production_url) {
            $allowed_origins[] = rtrim($production_url, '/');
        }

        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

        if (in_array($origin, $allowed_origins, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce, X-MemoryMint-Token');
            header('Access-Control-Allow-Credentials: true');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit;
        }
    }

    /**
     * Get a plugin option with default fallback.
     */
    public static function get_option($key, $default = '') {
        return get_option('memorymint_' . $key, $default);
    }

    /**
     * Update a plugin option.
     */
    public static function update_option($key, $value) {
        return update_option('memorymint_' . $key, $value);
    }

    /**
     * Get the current network (preprod or mainnet).
     */
    public static function get_network() {
        return self::get_option('network', 'preprod');
    }

    /**
     * Get the Anvil API key for the current network.
     */
    public static function get_anvil_api_key() {
        $network = self::get_network();
        return self::get_option('anvil_api_key_' . $network, '');
    }

    /**
     * Get the merchant wallet address.
     */
    public static function get_merchant_address() {
        return self::get_option('merchant_address', '');
    }

    /**
     * Get the per-keepsake service fee in USD for a given file type.
     *
     * When $batch_size >= 5 (a full batch of 5 same-type files), the total
     * batch price is divided equally across the 5 keepsakes. Mixed batches
     * (different types) are handled by the caller using per-unit pricing.
     *
     * Falls back to the image fee when the type is unrecognised.
     */
    public static function get_service_fee(string $file_type = 'image', int $batch_size = 1): float {
        $unit_keys = [
            'image' => 'service_fee_image',
            'video' => 'service_fee_video',
            'audio' => 'service_fee_audio',
        ];
        $batch_keys = [
            'image' => 'service_fee_image_batch',
            'video' => 'service_fee_video_batch',
            'audio' => 'service_fee_audio_batch',
        ];

        if ($batch_size >= 5 && isset($batch_keys[$file_type])) {
            $batch_total = floatval(self::get_option($batch_keys[$file_type], '10.00'));
            return round($batch_total / 5, 6);
        }

        $option_key = $unit_keys[$file_type] ?? 'service_fee_image';
        return floatval(self::get_option($option_key, '2.50'));
    }

    /**
     * Checks policy wallet balance and emails an alert when it runs low.
     * Runs via WP Cron (twicedaily). Deduplication via transients prevents spam.
     */
    public function check_policy_wallet_balance() {
        $network = self::get_network();
        $api_key = self::get_anvil_api_key();
        if (empty($api_key)) {
            return;
        }

        global $wpdb;
        $table  = $wpdb->prefix . 'memorymint_policy_wallets';
        $wallet = $wpdb->get_row($wpdb->prepare(
            "SELECT payment_address FROM $table WHERE network = %s AND is_active = 1 LIMIT 1",
            $network
        ));
        if (!$wallet) {
            return;
        }

        $anvil   = new Services\AnvilService();
        $balance = $anvil->get_address_balance($wallet->payment_address);
        if ($balance === null) {
            return;
        }

        $alert_email = get_option('memorymint_wallet_alert_email', get_option('admin_email'));
        $mints_left  = max(0, floor($balance / 2.2));
        $addr        = $wallet->payment_address;
        $net_label   = strtoupper($network);

        if ($balance < 3 && !get_transient('memorymint_balance_critical_sent')) {
            $subject = '[Memory Mint] CRITICAL: Policy Wallet at ' . number_format($balance, 2) . ' ADA';
            $message = "CRITICAL — Your MemoryMint policy wallet is almost empty.\n\n"
                . "Balance:            " . number_format($balance, 2) . " ADA\n"
                . "Mints remaining:    ~" . $mints_left . "\n"
                . "Wallet address:     " . $addr . "\n"
                . "Network:            " . $net_label . "\n\n"
                . "Custodial mints will fail immediately if this runs out. Fund now.";
            wp_mail($alert_email, $subject, $message);
            set_transient('memorymint_balance_critical_sent', true, 6 * HOUR_IN_SECONDS);

        } elseif ($balance < 10 && !get_transient('memorymint_balance_warning_sent')) {
            $subject = '[Memory Mint] Warning: Policy Wallet at ' . number_format($balance, 2) . ' ADA';
            $message = "Warning — Your MemoryMint policy wallet balance is getting low.\n\n"
                . "Balance:            " . number_format($balance, 2) . " ADA\n"
                . "Mints remaining:    ~" . $mints_left . "\n"
                . "Wallet address:     " . $addr . "\n"
                . "Network:            " . $net_label . "\n\n"
                . "Top up soon to avoid custodial mint failures.";
            wp_mail($alert_email, $subject, $message);
            set_transient('memorymint_balance_warning_sent', true, 24 * HOUR_IN_SECONDS);
        }
    }

    /**
     * Add any missing columns introduced after initial install.
     * Uses SHOW COLUMNS so the ALTER only fires once per install, ever.
     */
    public function maybe_run_migrations() {
        global $wpdb;
        $tx_table = $wpdb->prefix . 'memorymint_transactions';

        // v1: add error_message column
        $has_error_col = $wpdb->get_results(
            $wpdb->prepare("SHOW COLUMNS FROM $tx_table LIKE %s", 'error_message')
        );
        if (empty($has_error_col)) {
            $wpdb->query("ALTER TABLE $tx_table ADD COLUMN error_message text DEFAULT NULL AFTER status");
        }

        // v2: seed per-type and batch fee options for existing installs
        add_option('memorymint_service_fee_image', '2.50');
        add_option('memorymint_service_fee_video', '5.00');
        add_option('memorymint_service_fee_audio', '2.50');
        add_option('memorymint_service_fee_image_batch', '10.00');
        add_option('memorymint_service_fee_video_batch', '20.00');
        add_option('memorymint_service_fee_audio_batch', '10.00');

        // v3: create album tables for existing installs
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset_collate = $wpdb->get_charset_collate();

        $albums_table = $wpdb->prefix . 'memorymint_albums';
        dbDelta("CREATE TABLE $albums_table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(100) NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id)
        ) $charset_collate;");

        $pivot_table = $wpdb->prefix . 'memorymint_album_keepsakes';
        dbDelta("CREATE TABLE $pivot_table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            album_id bigint(20) unsigned NOT NULL,
            keepsake_id bigint(20) unsigned NOT NULL,
            added_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY album_keepsake (album_id, keepsake_id),
            KEY album_id (album_id),
            KEY keepsake_id (keepsake_id)
        ) $charset_collate;");
    }
}
