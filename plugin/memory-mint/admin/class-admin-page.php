<?php
namespace MemoryMint\Admin;

if (!defined('ABSPATH')) {
    exit;
}

class AdminPage {

    public function __construct() {
        add_action('admin_menu', [$this, 'add_menu_pages']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_notices', [$this, 'show_admin_notices']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_styles']);
        add_action('admin_post_memorymint_generate_wallet', [$this, 'handle_generate_wallet']);
        add_action('admin_post_memorymint_test_anvil', [$this, 'handle_test_anvil']);
        add_action('admin_post_memorymint_test_email', [$this, 'handle_test_email']);
    }

    public function show_admin_notices() {
        // Only show on Memory Mint admin pages
        $screen = get_current_screen();
        if (!$screen || strpos($screen->id, 'memory-mint') === false) {
            return;
        }

        $network  = \MemoryMint\MemoryMint::get_network();
        $api_key  = \MemoryMint\MemoryMint::get_anvil_api_key();

        if (empty($api_key)) {
            $settings_url = admin_url('admin.php?page=memory-mint-settings');
            echo '<div class="notice notice-warning"><p>';
            printf(
                '<strong>Memory Mint:</strong> No Anvil API key is configured for the <strong>%s</strong> network. '
                . '<a href="%s">Enter your API key in Settings</a> to enable minting.',
                esc_html(ucfirst($network)),
                esc_url($settings_url)
            );
            echo '</p></div>';
        }

        $active_wallets = $this->get_active_wallet_count($network);
        if ($active_wallets === 0) {
            $wallet_url = admin_url('admin.php?page=memory-mint-wallet');
            echo '<div class="notice notice-warning"><p>';
            printf(
                '<strong>Memory Mint:</strong> No policy wallet is configured for the <strong>%s</strong> network. '
                . '<a href="%s">Generate a policy wallet</a> to enable minting.',
                esc_html(ucfirst($network)),
                esc_url($wallet_url)
            );
            echo '</p></div>';
        }

        // Production URL missing — share emails will link to localhost
        $production_url = get_option('memorymint_production_url', '');
        if (empty($production_url)) {
            $settings_url = admin_url('admin.php?page=memory-mint-settings');
            echo '<div class="notice notice-warning"><p>';
            printf(
                '<strong>Memory Mint:</strong> No Production Frontend URL is set. '
                . 'Share invitation emails will contain <code>localhost:3000</code> links and will not work for recipients. '
                . '<a href="%s">Set it in Settings →</a>',
                esc_url($settings_url)
            );
            echo '</p></div>';
        }

        // Low balance warning — only when a wallet and API key exist
        if ($active_wallets > 0 && !empty($api_key)) {
            global $wpdb;
            $table  = $wpdb->prefix . 'memorymint_policy_wallets';
            $wallet = $wpdb->get_row($wpdb->prepare(
                "SELECT payment_address FROM $table WHERE network = %s AND is_active = 1 LIMIT 1",
                $network
            ));
            if ($wallet) {
                $anvil   = new \MemoryMint\Services\AnvilService();
                $balance = $anvil->get_address_balance($wallet->payment_address);
                if ($balance !== null && $balance < 10) {
                    $wallet_url = admin_url('admin.php?page=memory-mint-wallet');
                    $level      = $balance < 3 ? 'notice-error' : 'notice-warning';
                    echo '<div class="notice ' . esc_attr($level) . '"><p>';
                    printf(
                        '<strong>Memory Mint:</strong> Policy wallet balance is <strong>%s ADA</strong>. '
                        . 'Custodial mints need ≥2.2 ADA each. '
                        . '<a href="%s">Fund it now →</a>',
                        esc_html(number_format($balance, 2)),
                        esc_url($wallet_url)
                    );
                    echo '</p></div>';
                }
            }
        }
    }

    private function get_active_wallet_count(string $network): int {
        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_policy_wallets';
        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM $table WHERE network = %s AND is_active = 1",
                $network
            )
        );
    }

    public function add_menu_pages() {
        add_menu_page(
            'Memory Mint',
            'Memory Mint',
            'manage_options',
            'memory-mint',
            [$this, 'render_overview_page'],
            'dashicons-camera',
            30
        );

        add_submenu_page(
            'memory-mint',
            'Overview',
            'Overview',
            'manage_options',
            'memory-mint',
            [$this, 'render_overview_page']
        );

        add_submenu_page(
            'memory-mint',
            'Settings',
            'Settings',
            'manage_options',
            'memory-mint-settings',
            [$this, 'render_settings_page']
        );

        add_submenu_page(
            'memory-mint',
            'Keepsakes',
            'Keepsakes',
            'manage_options',
            'memory-mint-keepsakes',
            [$this, 'render_keepsakes_page']
        );

        add_submenu_page(
            'memory-mint',
            'Transactions',
            'Transactions',
            'manage_options',
            'memory-mint-transactions',
            [$this, 'render_transactions_page']
        );

        add_submenu_page(
            'memory-mint',
            'Policy Wallet',
            'Policy Wallet',
            'manage_options',
            'memory-mint-wallet',
            [$this, 'render_wallet_page']
        );

        add_submenu_page(
            'memory-mint',
            'Users',
            'Users',
            'manage_options',
            'memory-mint-users',
            [$this, 'render_users_page']
        );
    }

    public function register_settings() {
        // General settings
        register_setting('memorymint_settings', 'memorymint_network', [
            'type' => 'string',
            'sanitize_callback' => function ($val) {
                return in_array($val, ['preprod', 'mainnet']) ? $val : 'preprod';
            },
        ]);
        register_setting('memorymint_settings', 'memorymint_merchant_address', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);
        $fee_options = [
            'memorymint_service_fee_image',
            'memorymint_service_fee_video',
            'memorymint_service_fee_audio',
            'memorymint_service_fee_image_batch',
            'memorymint_service_fee_video_batch',
            'memorymint_service_fee_audio_batch',
        ];
        foreach ($fee_options as $fee_option) {
            register_setting('memorymint_settings', $fee_option, [
                'type' => 'string',
                'sanitize_callback' => function ($val) {
                    return max(0, floatval($val));
                },
            ]);
        }
        register_setting('memorymint_settings', 'memorymint_production_url', [
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ]);

        // API keys
        register_setting('memorymint_settings', 'memorymint_anvil_api_key_preprod', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);
        register_setting('memorymint_settings', 'memorymint_anvil_api_key_mainnet', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);

        // File limits
        register_setting('memorymint_settings', 'memorymint_max_image_size', [
            'type' => 'integer',
            'sanitize_callback' => 'absint',
        ]);
        register_setting('memorymint_settings', 'memorymint_max_video_size', [
            'type' => 'integer',
            'sanitize_callback' => 'absint',
        ]);
        register_setting('memorymint_settings', 'memorymint_max_audio_size', [
            'type' => 'integer',
            'sanitize_callback' => 'absint',
        ]);

        // Cleanup option
        register_setting('memorymint_settings', 'memorymint_delete_data_on_deactivate', [
            'type' => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
        ]);
    }

    public function enqueue_styles($hook) {
        if (strpos($hook, 'memory-mint') === false) {
            return;
        }
        wp_enqueue_style(
            'memorymint-admin',
            MEMORYMINT_PLUGIN_URL . 'admin/css/admin.css',
            [],
            MEMORYMINT_VERSION
        );
    }

    public function render_overview_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/overview.php';
    }

    public function render_settings_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/settings.php';
    }

    public function render_keepsakes_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/keepsakes.php';
    }

    public function render_transactions_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/transactions.php';
    }

    public function render_wallet_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/policy-wallet.php';
    }

    public function render_users_page() {
        require_once MEMORYMINT_PLUGIN_DIR . 'admin/views/users.php';
    }

    public function handle_generate_wallet() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('memorymint_generate_wallet');

        $network = \MemoryMint\MemoryMint::get_network();
        $wallet_name = sanitize_text_field($_POST['wallet_name'] ?? 'Policy Wallet');

        $result = \CardanoWalletPHP::generateWallet($network);

        if (!$result['success']) {
            wp_redirect(admin_url('admin.php?page=memory-mint-wallet&error=generation_failed'));
            exit;
        }

        // Encrypt sensitive data
        $mnemonic_encrypted = \MemoryMint\Helpers\Encryption::encrypt($result['mnemonic']);
        $skey_encrypted = \MemoryMint\Helpers\Encryption::encrypt($result['payment_skey_extended']);

        // Build CIP-25 native script and derive its policy ID.
        // Script: {"type":"sig","keyHash":"<payment_keyhash>"}
        // CBOR of [0, bstr(keyhash_bytes)] = 0x82 0x00 0x58 0x1c <28 bytes>
        $payment_keyhash = $result['payment_keyhash'];
        $policy_json     = json_encode(['type' => 'sig', 'keyHash' => $payment_keyhash]);
        $keyhash_bytes   = hex2bin($payment_keyhash);
        $cbor_script     = "\x82\x00\x58\x1c" . $keyhash_bytes; // array(2), uint(0), bytes(28)
        $policy_id       = bin2hex(sodium_crypto_generichash($cbor_script, '', 28)); // blake2b-224

        // Store in database
        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_policy_wallets';

        // Deactivate existing wallets for this network
        $wpdb->update($table, ['is_active' => 0], ['network' => $network, 'is_active' => 1]);

        $wpdb->insert($table, [
            'wallet_name'       => $wallet_name,
            'mnemonic_encrypted'=> $mnemonic_encrypted,
            'skey_encrypted'    => $skey_encrypted,
            'payment_address'   => $result['addresses']['payment_address'],
            'payment_keyhash'   => $payment_keyhash,
            'stake_address'     => $result['addresses']['stake_address'] ?? '',
            'policy_json'       => $policy_json,
            'policy_id'         => $policy_id,
            'network'           => $network,
            'is_active'         => 1,
        ]);

        // Store mnemonic temporarily in transient for one-time display
        set_transient('memorymint_new_wallet_mnemonic', $result['mnemonic'], 300); // 5 minutes

        wp_redirect(admin_url('admin.php?page=memory-mint-wallet&generated=1'));
        exit;
    }

    public function handle_test_anvil() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('memorymint_test_anvil');

        $api_key = \MemoryMint\MemoryMint::get_anvil_api_key();
        $network = \MemoryMint\MemoryMint::get_network();

        if (empty($api_key)) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&anvil_test=no_key'));
            exit;
        }

        $base_url = $network === 'mainnet'
            ? 'https://api.ada-anvil.app/v1'
            : 'https://preprod.api.ada-anvil.app/v1';

        $response = wp_remote_get($base_url . '/services/health', [
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
            ],
            'timeout' => 10,
        ]);

        if (is_wp_error($response)) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&anvil_test=error&msg=' . urlencode($response->get_error_message())));
            exit;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code === 200) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&anvil_test=success'));
        } else {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&anvil_test=failed&code=' . $code));
        }
        exit;
    }

    public function handle_test_email() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('memorymint_test_email');

        $to      = get_option('admin_email');
        $subject = '[Memory Mint] Test Email';
        $message = "This is a test email from Memory Mint.\n\nIf you received this, your WordPress mail configuration is working correctly.\n\nSent: " . current_time('mysql');
        $sent    = wp_mail($to, $subject, $message);

        $result = $sent ? 'sent' : 'failed';
        wp_redirect(admin_url('admin.php?page=memory-mint-settings&email_test=' . $result . '&to=' . rawurlencode($to)));
        exit;
    }
}
