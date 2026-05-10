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
        add_action('admin_post_memorymint_test_anvil',    [$this, 'handle_test_anvil']);
        add_action('admin_post_memorymint_test_email',    [$this, 'handle_test_email']);
        add_action('admin_post_memorymint_test_midnight',   [$this, 'handle_test_midnight']);
        add_action('admin_post_memorymint_diagnose_balance', [$this, 'handle_diagnose_balance']);
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

        // CIP-25 → CIP-68 migration reminder (mainnet only)
        if ($network === 'mainnet') {
            echo '<div class="notice notice-info"><p>';
            echo '<strong>Memory Mint — Mainnet pre-launch reminder:</strong> NFTs are currently minted using '
               . '<strong>CIP-25 (label 721)</strong>. Before mainnet launch, migrate the minting flow to '
               . '<strong>CIP-68</strong> for better wallet composability and on-chain metadata. '
               . 'See the audit finding L4 in the project README.';
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

        // Midnight sidecar
        register_setting('memorymint_settings', 'memorymint_midnight_sidecar_url', [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ]);
        register_setting('memorymint_settings', 'memorymint_midnight_api_secret', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);

        // Wallet alert email
        register_setting('memorymint_settings', 'memorymint_wallet_alert_email', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_email',
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

        $network     = \MemoryMint\MemoryMint::get_network();
        $wallet_name = sanitize_text_field($_POST['wallet_name'] ?? 'Policy Wallet');
        $before_slot = isset($_POST['before_slot']) ? intval($_POST['before_slot']) : 0;

        $result = \CardanoWalletPHP::generateWallet($network);

        if (!$result['success']) {
            wp_redirect(admin_url('admin.php?page=memory-mint-wallet&error=generation_failed'));
            exit;
        }

        // Encrypt sensitive data
        $mnemonic_encrypted = \MemoryMint\Helpers\Encryption::encrypt($result['mnemonic']);
        $skey_encrypted     = \MemoryMint\Helpers\Encryption::encrypt($result['payment_skey_extended']);

        // Build native script and derive its policy ID via blake2b-224 of the CBOR encoding.
        $payment_keyhash = $result['payment_keyhash'];
        $keyhash_bytes   = hex2bin($payment_keyhash);
        $sig_cbor        = "\x82\x00\x58\x1c" . $keyhash_bytes; // [0, h'keyhash'] (28 bytes)

        if ($before_slot > 0 && $network === 'mainnet') {
            // Time-locked script: {"type":"all","scripts":[{"type":"sig","keyHash":"..."},{"type":"before","slot":N}]}
            // CBOR: [1, [[0, h'keyhash'], [5, N]]]
            $before_cbor = "\x82\x05" . self::cbor_uint($before_slot); // [5, N]
            $cbor_script = "\x82\x01\x82" . $sig_cbor . $before_cbor;  // [1, [sig, before]]
            $policy_json = json_encode([
                'type'    => 'all',
                'scripts' => [
                    ['type' => 'sig',    'keyHash' => $payment_keyhash],
                    ['type' => 'before', 'slot'    => $before_slot],
                ],
            ]);
        } else {
            // Simple sig-only script (preprod or mainnet without time-lock)
            $cbor_script = $sig_cbor;
            $policy_json = json_encode(['type' => 'sig', 'keyHash' => $payment_keyhash]);
        }

        $policy_id = bin2hex(sodium_crypto_generichash($cbor_script, '', 28)); // blake2b-224

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

    /**
     * Encode a non-negative integer as a CBOR unsigned integer (major type 0).
     * Used when building time-locked native script CBOR for mainnet policy wallets.
     */
    private static function cbor_uint(int $n): string {
        if ($n < 0)             return '';               // guard — should never happen
        if ($n < 24)            return chr($n);
        if ($n < 0x100)         return "\x18" . chr($n);
        if ($n < 0x10000)       return "\x19" . pack('n', $n);
        if ($n < 0x100000000)   return "\x1a" . pack('N', $n);
        return "\x1b" . pack('J', $n);
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

    public function handle_test_midnight() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('memorymint_test_midnight');

        $sidecar_url = get_option('memorymint_midnight_sidecar_url', '');
        $api_secret  = get_option('memorymint_midnight_api_secret', '');

        if (empty($sidecar_url) || empty($api_secret)) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&midnight_test=no_config'));
            exit;
        }

        $response = wp_remote_get(rtrim($sidecar_url, '/') . '/health', [
            'headers' => ['x-api-secret' => $api_secret],
            'timeout' => 15,
        ]);

        if (is_wp_error($response)) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&midnight_test=error&msg=' . urlencode($response->get_error_message())));
            exit;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code === 200) {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&midnight_test=success'));
        } else {
            wp_redirect(admin_url('admin.php?page=memory-mint-settings&midnight_test=failed&code=' . $code));
        }
        exit;
    }

    public function handle_diagnose_balance() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        check_admin_referer('memorymint_diagnose_balance');

        $network = \MemoryMint\MemoryMint::get_network();
        $api_key = \MemoryMint\MemoryMint::get_anvil_api_key();
        $diag    = ['timestamp' => current_time('mysql'), 'network' => $network];

        if (empty($api_key)) {
            $diag['status']  = 'no_key';
            $diag['message'] = 'No Anvil API key configured for ' . strtoupper($network) . '.';
        } else {
            $diag['api_key_preview'] = substr($api_key, 0, 8) . '…';

            global $wpdb;
            $table  = $wpdb->prefix . 'memorymint_policy_wallets';
            $wallet = $wpdb->get_row($wpdb->prepare(
                "SELECT payment_address FROM $table WHERE network = %s AND is_active = 1 LIMIT 1",
                $network
            ));

            if (!$wallet) {
                $diag['status']  = 'no_wallet';
                $diag['message'] = 'No active policy wallet found for ' . strtoupper($network) . '.';
            } else {
                $base_url = $network === 'mainnet'
                    ? 'https://api.ada-anvil.app/v1'
                    : 'https://preprod.api.ada-anvil.app/v1';
                $url = $base_url . '/addresses/' . rawurlencode($wallet->payment_address);

                $diag['address'] = $wallet->payment_address;
                $diag['url']     = $url;

                // Also clear the balance transient so we get a fresh call.
                delete_transient('memorymint_wallet_balance_' . md5($wallet->payment_address));

                $response = wp_remote_get($url, [
                    'headers' => ['Authorization' => 'Bearer ' . $api_key],
                    'timeout' => 15,
                ]);

                if (is_wp_error($response)) {
                    $diag['status']  = 'wp_error';
                    $diag['message'] = $response->get_error_message();
                } else {
                    $code = wp_remote_retrieve_response_code($response);
                    $body = wp_remote_retrieve_body($response);
                    $diag['http_code']     = $code;
                    $diag['status']        = 'http_' . $code;
                    $diag['response_body'] = substr($body, 0, 800);

                    // Try to parse and show the lovelace amount if present.
                    $json = json_decode($body, true);
                    if (is_array($json)) {
                        foreach ((array) ($json['amount'] ?? []) as $item) {
                            if (($item['unit'] ?? '') === 'lovelace') {
                                $diag['lovelace_found'] = intval($item['quantity']);
                                $diag['ada']            = round($diag['lovelace_found'] / 1_000_000, 6);
                                break;
                            }
                        }
                    }
                }
            }
        }

        set_transient('memorymint_balance_diagnostic', $diag, 30 * MINUTE_IN_SECONDS);

        wp_redirect(admin_url('admin.php?page=memory-mint-wallet&diagnosed=1'));
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
