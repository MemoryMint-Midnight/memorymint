<?php
namespace MemoryMint\Api;

use MemoryMint\Helpers\Validation;
use MemoryMint\Helpers\Encryption;

if (!defined('ABSPATH')) {
    exit;
}

// Load CardanoWalletPHP (no namespace — plain class in lib/)
if (!class_exists('CardanoWalletPHP')) {
    require_once dirname(__FILE__, 2) . '/lib/CardanoWalletPHP.php';
}

class AuthApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/auth/wallet-connect', [
            'methods' => 'POST',
            'callback' => [$this, 'wallet_connect'],
            'permission_callback' => '__return_true',
            'args' => [
                'wallet_address' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'stake_address' => [
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'wallet_name' => [
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/email-connect', [
            'methods' => 'POST',
            'callback' => [$this, 'email_connect'],
            'permission_callback' => '__return_true',
            'args' => [
                'email' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_email',
                ],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/email-verify', [
            'methods' => 'POST',
            'callback' => [$this, 'email_verify'],
            'permission_callback' => '__return_true',
            'args' => [
                'email' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_email',
                ],
                'otp' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/verify', [
            'methods' => 'POST',
            'callback' => [$this, 'verify_token'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/auth/refresh', [
            'methods'             => 'POST',
            'callback'            => [$this, 'refresh_token'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/logout', [
            'methods' => 'POST',
            'callback' => [$this, 'logout'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/me', [
            'methods' => 'GET',
            'callback' => [$this, 'get_profile'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/seed-phrase', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_seed_phrase'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/confirm-backup', [
            'methods'             => 'POST',
            'callback'            => [$this, 'confirm_backup'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/delete-account', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'delete_account'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/export', [
            'methods'             => 'GET',
            'callback'            => [$this, 'export_data'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/contact', [
            'methods'             => 'POST',
            'callback'            => [$this, 'contact_support'],
            'permission_callback' => '__return_true',
            'args'                => [
                'name'    => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'email'   => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_email'],
                'subject' => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'message' => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'],
            ],
        ]);
    }

    /**
     * Permanently delete the authenticated user's account and all associated data.
     * On-chain blockchain records are unaffected — they are permanent by design.
     */
    public function delete_account(\WP_REST_Request $request) {
        global $wpdb;
        $user_id = get_current_user_id();

        // Prevent admins from self-deleting via this endpoint
        if (user_can($user_id, 'manage_options')) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Administrator accounts cannot be deleted via this endpoint.',
            ], 403);
        }

        // ── 1. Delete uploaded media files from disk ─────────────────────────
        $k_table         = $wpdb->prefix . 'memorymint_keepsakes';
        $attachment_ids  = $wpdb->get_col($wpdb->prepare(
            "SELECT file_attachment_id FROM $k_table WHERE user_id = %d AND file_attachment_id IS NOT NULL",
            $user_id
        ));
        foreach ($attachment_ids as $att_id) {
            wp_delete_attachment(intval($att_id), true); // true = delete file from disk
        }

        // ── 2. Delete share links created by this user ───────────────────────
        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $wpdb->delete($share_table, ['created_by' => $user_id], ['%d']);

        // ── 3. Delete album–keepsake pivot rows for user's albums ─────────────
        $a_table  = $wpdb->prefix . 'memorymint_albums';
        $ak_table = $wpdb->prefix . 'memorymint_album_keepsakes';
        $album_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT id FROM $a_table WHERE user_id = %d",
            $user_id
        ));
        if (!empty($album_ids)) {
            $placeholders = implode(',', array_fill(0, count($album_ids), '%d'));
            $wpdb->query($wpdb->prepare(
                "DELETE FROM $ak_table WHERE album_id IN ($placeholders)",
                ...$album_ids
            ));
        }

        // ── 4. Delete albums, keepsakes, transactions ─────────────────────────
        $wpdb->delete($a_table,                                         ['user_id' => $user_id], ['%d']);
        $wpdb->delete($k_table,                                         ['user_id' => $user_id], ['%d']);
        $wpdb->delete($wpdb->prefix . 'memorymint_transactions',        ['user_id' => $user_id], ['%d']);

        // ── 5. Delete the WordPress user (also removes all user meta) ─────────
        require_once ABSPATH . 'wp-admin/includes/user.php';
        wp_delete_user($user_id);

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * Export all data held for the authenticated user as a JSON payload.
     */
    public function export_data(\WP_REST_Request $request) {
        global $wpdb;
        $user_id = get_current_user_id();
        $user    = get_user_by('ID', $user_id);

        // ── Account ──────────────────────────────────────────────────────────
        $account = [
            'id'             => $user_id,
            'email'          => $user->user_email,
            'display_name'   => $user->display_name,
            'wallet_address' => get_user_meta($user_id, 'memorymint_wallet_address', true) ?: null,
            'stake_address'  => get_user_meta($user_id, 'memorymint_stake_address',  true) ?: null,
            'auth_method'    => get_user_meta($user_id, 'memorymint_auth_method',    true) ?: 'unknown',
            'registered'     => $user->user_registered,
        ];

        // ── Keepsakes ─────────────────────────────────────────────────────────
        $k_table   = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsakes = $wpdb->get_results($wpdb->prepare(
            "SELECT id, title, description, privacy, file_type, file_url, tx_hash, mint_status, created_at
             FROM $k_table WHERE user_id = %d ORDER BY created_at DESC",
            $user_id
        ), ARRAY_A);

        // ── Albums ────────────────────────────────────────────────────────────
        $a_table  = $wpdb->prefix . 'memorymint_albums';
        $ak_table = $wpdb->prefix . 'memorymint_album_keepsakes';
        $albums   = $wpdb->get_results($wpdb->prepare(
            "SELECT a.id, a.name, a.created_at,
                    GROUP_CONCAT(ak.keepsake_id ORDER BY ak.added_at SEPARATOR ',') AS keepsake_ids
             FROM $a_table a
             LEFT JOIN $ak_table ak ON ak.album_id = a.id
             WHERE a.user_id = %d
             GROUP BY a.id ORDER BY a.created_at DESC",
            $user_id
        ), ARRAY_A);

        foreach ($albums as &$album) {
            $album['keepsake_ids'] = $album['keepsake_ids']
                ? array_map('intval', explode(',', $album['keepsake_ids']))
                : [];
            $album['id'] = intval($album['id']);
        }
        unset($album);

        return new \WP_REST_Response([
            'success'     => true,
            'exported_at' => gmdate('c'),
            'account'     => $account,
            'keepsakes'   => $keepsakes ?: [],
            'albums'      => $albums    ?: [],
        ], 200);
    }

    /**
     * Send a contact/support message to the site admin via wp_mail().
     */
    public function contact_support(\WP_REST_Request $request) {
        $name    = $request->get_param('name');
        $email   = $request->get_param('email');
        $subject = $request->get_param('subject') ?: 'Memory Mint Support Request';
        $message = $request->get_param('message');

        if (!is_email($email)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid email address.'], 400);
        }

        $admin_email = get_option('admin_email');
        $body = sprintf(
            "Name: %s\nEmail: %s\nSubject: %s\n\n---\n\n%s",
            $name, $email, $subject, $message
        );

        $sent = wp_mail(
            $admin_email,
            '[Memory Mint Support] ' . $subject,
            $body,
            [
                'Content-Type: text/plain; charset=UTF-8',
                'Reply-To: ' . $name . ' <' . $email . '>',
            ]
        );

        if (!$sent) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Failed to send message. Please try again.'], 500);
        }

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * Authenticate via Cardano wallet address.
     * Creates a WordPress user if one doesn't exist for this wallet.
     */
    public function wallet_connect(\WP_REST_Request $request) {
        $wallet_address = $request->get_param('wallet_address');
        $stake_address = $request->get_param('stake_address') ?? '';
        $wallet_name = $request->get_param('wallet_name') ?? 'cardano';

        if (!$wallet_address) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Wallet address is required.',
            ], 400);
        }

        // Look up user by wallet address in user meta
        $users = get_users([
            'meta_key' => 'memorymint_wallet_address',
            'meta_value' => $wallet_address,
            'number' => 1,
        ]);

        if (!empty($users)) {
            $user = $users[0];
        } else {
            // Check if CardanoPress has linked this wallet to a user
            if (function_exists('cardanoPress')) {
                $cp_users = get_users([
                    'meta_key' => 'cardanopress_connected_wallet',
                    'meta_value' => $wallet_address,
                    'number' => 1,
                ]);
                if (!empty($cp_users)) {
                    $user = $cp_users[0];
                    update_user_meta($user->ID, 'memorymint_wallet_address', $wallet_address);
                }
            }
        }

        // Create new user if not found
        if (!isset($user)) {
            $short_addr = substr($wallet_address, 0, 12) . '...' . substr($wallet_address, -6);
            $username = 'wallet_' . substr(md5($wallet_address), 0, 10);
            $email = $username . '@wallet.memorymint.local';
            $password = wp_generate_password(32, true, true);

            $user_id = wp_create_user($username, $password, $email);

            if (is_wp_error($user_id)) {
                return new \WP_REST_Response([
                    'success' => false,
                    'error' => 'Failed to create user account.',
                ], 500);
            }

            $user = get_user_by('ID', $user_id);
            $user->set_role('subscriber');

            update_user_meta($user_id, 'memorymint_wallet_address', $wallet_address);
            update_user_meta($user_id, 'memorymint_stake_address', $stake_address);
            update_user_meta($user_id, 'memorymint_wallet_name', $wallet_name);
            update_user_meta($user_id, 'memorymint_auth_method', 'wallet');
            update_user_meta($user_id, 'display_name', $short_addr);
        }

        // Update wallet info on each login
        update_user_meta($user->ID, 'memorymint_wallet_address', $wallet_address);
        if ($stake_address) {
            update_user_meta($user->ID, 'memorymint_stake_address', $stake_address);
        }
        update_user_meta($user->ID, 'memorymint_last_login', current_time('mysql'));

        // Generate application password for API auth
        $token = $this->generate_auth_token($user);

        return new \WP_REST_Response([
            'success' => true,
            'user' => $this->format_user($user),
            'token' => $token,
        ], 200);
    }

    /**
     * Authenticate via email address.
     * Creates a WordPress user if one doesn't exist for this email.
     */
    public function email_connect(\WP_REST_Request $request) {
        $email = $request->get_param('email');

        if (!Validation::validate_email($email)) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Valid email address is required.',
            ], 400);
        }

        // Rate limit: max 5 OTP requests per 10-minute window per email address
        $rate_key  = 'memorymint_otp_rate_' . md5(strtolower($email));
        $attempts  = (int) get_transient($rate_key);
        if ($attempts >= 5) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Too many requests. Please wait 10 minutes before requesting another code.',
            ], 429);
        }
        set_transient($rate_key, $attempts + 1, 10 * MINUTE_IN_SECONDS);

        $user = get_user_by('email', $email);

        if (!$user) {
            $username = 'mm_' . substr(md5($email), 0, 10);
            $password = wp_generate_password(32, true, true);

            $user_id = wp_create_user($username, $password, $email);

            if (is_wp_error($user_id)) {
                // Username might exist, try with different suffix
                $username .= '_' . wp_rand(100, 999);
                $user_id = wp_create_user($username, $password, $email);

                if (is_wp_error($user_id)) {
                    return new \WP_REST_Response([
                        'success' => false,
                        'error' => 'Failed to create user account.',
                    ], 500);
                }
            }

            $user = get_user_by('ID', $user_id);
            $user->set_role('subscriber');

            update_user_meta($user_id, 'memorymint_auth_method', 'email');
        }

        // Send OTP — token is issued only after the code is verified via email_verify
        $result = $this->send_otp($user);

        if (!$result['sent'] && !(defined('WP_DEBUG') && WP_DEBUG)) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Failed to send verification code. Please try again.',
            ], 500);
        }

        $response = [
            'success'     => true,
            'requires_otp' => true,
        ];

        // In debug mode, surface the OTP in the API response so local dev works
        // without a working mail server. NEVER enable WP_DEBUG in production.
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $response['debug_otp'] = $result['otp'];
        }

        return new \WP_REST_Response($response, 200);
    }

    /**
     * Verify a 6-digit OTP, provision custodial wallet, and issue auth token.
     */
    public function email_verify(\WP_REST_Request $request) {
        $email = $request->get_param('email');
        $otp   = preg_replace('/\D/', '', $request->get_param('otp')); // digits only

        if (!Validation::validate_email($email)) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Valid email address is required.',
            ], 400);
        }

        $user = get_user_by('email', $email);
        if (!$user) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Invalid verification code.',
            ], 401);
        }

        // Check expiry
        $expiry = get_user_meta($user->ID, 'memorymint_otp_expiry', true);
        if (!$expiry || time() > intval($expiry)) {
            delete_user_meta($user->ID, 'memorymint_otp_hash');
            delete_user_meta($user->ID, 'memorymint_otp_expiry');
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Verification code has expired. Please request a new one.',
            ], 401);
        }

        // Validate OTP
        $stored_hash = get_user_meta($user->ID, 'memorymint_otp_hash', true);
        if (!$stored_hash || !wp_check_password($otp, $stored_hash)) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Invalid verification code.',
            ], 401);
        }

        // Consume OTP — single use
        delete_user_meta($user->ID, 'memorymint_otp_hash');
        delete_user_meta($user->ID, 'memorymint_otp_expiry');
        update_user_meta($user->ID, 'memorymint_last_login', current_time('mysql'));

        // Provision custodial wallet now that email ownership is confirmed
        $this->provision_custodial_wallet($user->ID);

        $token = $this->generate_auth_token($user);

        return new \WP_REST_Response([
            'success' => true,
            'user' => $this->format_user($user),
            'token' => $token,
        ], 200);
    }

    /**
     * Verify an auth token.
     */
    public function verify_token(\WP_REST_Request $request) {
        $token = $this->extract_token($request);

        if (!$token) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'No token provided.',
            ], 401);
        }

        $user_id = $this->validate_token($token);

        if (!$user_id) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Invalid or expired token.',
            ], 401);
        }

        $user = get_user_by('ID', $user_id);
        if (!$user) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'User not found.',
            ], 404);
        }

        return new \WP_REST_Response([
            'success' => true,
            'user' => $this->format_user($user),
        ], 200);
    }

    /**
     * Issue a fresh token for an already-authenticated user.
     * The old token is invalidated (overwritten) and a new 7-day token is returned.
     */
    public function refresh_token(\WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $user    = get_user_by('ID', $user_id);

        if (!$user) {
            return new \WP_REST_Response(['success' => false, 'error' => 'User not found.'], 404);
        }

        $new_token  = $this->generate_auth_token($user);
        $expires_at = time() + (7 * DAY_IN_SECONDS);

        return new \WP_REST_Response([
            'success'    => true,
            'token'      => $new_token,
            'expires_at' => $expires_at,
        ], 200);
    }

    /**
     * Log out (invalidate token).
     */
    public function logout(\WP_REST_Request $request) {
        $token = $this->extract_token($request);

        if ($token) {
            $user_id = $this->validate_token($token);
            if ($user_id) {
                delete_user_meta($user_id, 'memorymint_auth_token');
                delete_user_meta($user_id, 'memorymint_token_expiry');
            }
        }

        return new \WP_REST_Response([
            'success' => true,
            'message' => 'Logged out successfully.',
        ], 200);
    }

    /**
     * Get current user profile.
     */
    public function get_profile(\WP_REST_Request $request) {
        $user = wp_get_current_user();

        if (!$user || !$user->ID) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Not authenticated.',
            ], 401);
        }

        // Get keepsake count
        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsake_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE user_id = %d",
            $user->ID
        ));

        $profile = $this->format_user($user);
        $profile['keepsake_count'] = intval($keepsake_count);

        return new \WP_REST_Response([
            'success' => true,
            'user' => $profile,
        ], 200);
    }

    /**
     * Permission callback for authenticated endpoints.
     */
    public function check_auth(\WP_REST_Request $request) {
        $token = $this->extract_token($request);

        if (!$token) {
            return false;
        }

        $user_id = $this->validate_token($token);

        if (!$user_id) {
            return false;
        }

        // Set the current user for this request
        wp_set_current_user($user_id);

        return true;
    }

    /**
     * Generate a simple auth token stored in user meta.
     */
    private function generate_auth_token(\WP_User $user) {
        $token = bin2hex(random_bytes(32));
        $expiry = time() + (7 * DAY_IN_SECONDS); // 7 days

        $hashed_token = wp_hash_password($token);
        update_user_meta($user->ID, 'memorymint_auth_token', $hashed_token);
        update_user_meta($user->ID, 'memorymint_token_expiry', $expiry);
        update_user_meta($user->ID, 'memorymint_token_user_id', $user->ID);

        // Encode user ID with token for lookup
        return base64_encode($user->ID . ':' . $token);
    }

    /**
     * Validate a token and return the user ID.
     */
    private function validate_token($token) {
        $decoded = base64_decode($token);
        if (!$decoded || strpos($decoded, ':') === false) {
            return false;
        }

        list($user_id, $raw_token) = explode(':', $decoded, 2);
        $user_id = intval($user_id);

        if (!$user_id) {
            return false;
        }

        // Check expiry
        $expiry = get_user_meta($user_id, 'memorymint_token_expiry', true);
        if (!$expiry || time() > intval($expiry)) {
            return false;
        }

        // Check token hash
        $stored_hash = get_user_meta($user_id, 'memorymint_auth_token', true);
        if (!$stored_hash || !wp_check_password($raw_token, $stored_hash)) {
            return false;
        }

        return $user_id;
    }

    /**
     * Extract token from Authorization header or custom header.
     */
    private function extract_token(\WP_REST_Request $request) {
        // Check Authorization: Bearer <token>
        $auth_header = $request->get_header('Authorization');
        if ($auth_header && preg_match('/^Bearer\s+(.+)$/i', $auth_header, $matches)) {
            return $matches[1];
        }

        // Check custom header
        $custom = $request->get_header('X-MemoryMint-Token');
        if ($custom) {
            return $custom;
        }

        return null;
    }

    /**
     * Generate a 6-digit OTP, store it hashed in user meta, and send via email.
     */
    /**
     * Returns ['sent' => bool, 'otp' => string].
     * The raw OTP is only used to surface it in debug responses — never stored in plain text.
     */
    private function send_otp(\WP_User $user): array {
        $otp    = str_pad(strval(random_int(0, 999999)), 6, '0', STR_PAD_LEFT);
        $expiry = time() + (10 * MINUTE_IN_SECONDS);

        update_user_meta($user->ID, 'memorymint_otp_hash',   wp_hash_password($otp));
        update_user_meta($user->ID, 'memorymint_otp_expiry', $expiry);

        $site  = get_bloginfo('name') ?: 'Memory Mint';
        $subject = 'Your ' . $site . ' verification code';
        $message = "Hi,\n\nYour verification code is:\n\n    {$otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n\xe2\x80\x94 The {$site} Team";

        $sent = wp_mail($user->user_email, $subject, $message);

        return ['sent' => $sent, 'otp' => $otp];
    }

    /**
     * Provision a custodial Cardano wallet for an email user if they don't already have one.
     * Stores the encrypted mnemonic and signing key in user meta; the payment address goes
     * into memorymint_wallet_address so it's returned by format_user() automatically.
     */
    private function provision_custodial_wallet(int $user_id): void {
        // Already provisioned — wallet address exists
        if (get_user_meta($user_id, 'memorymint_wallet_address', true)) {
            return;
        }

        try {
            $network = get_option('memorymint_network', 'preprod');
            $wallet  = \CardanoWalletPHP::generateWallet($network);

            if (empty($wallet['success'])) {
                return; // Silent — don't break login if generation fails
            }

            $payment_address = $wallet['addresses']['payment_address'];
            $stake_address   = $wallet['addresses']['stake_address'];
            $mnemonic        = $wallet['mnemonic'];
            $skey_extended   = $wallet['payment_skey_extended']; // 128-hex extended signing key

            $encrypted_mnemonic = Encryption::encrypt($mnemonic);
            $encrypted_skey     = Encryption::encrypt($skey_extended);

            if (!$encrypted_mnemonic || !$encrypted_skey) {
                return; // Encryption failed — don't store partial data
            }

            update_user_meta($user_id, 'memorymint_wallet_address',               $payment_address);
            update_user_meta($user_id, 'memorymint_stake_address',                $stake_address);
            update_user_meta($user_id, 'memorymint_custodial_mnemonic_encrypted', $encrypted_mnemonic);
            update_user_meta($user_id, 'memorymint_custodial_skey_encrypted',     $encrypted_skey);
            update_user_meta($user_id, 'memorymint_custodial_network',            $network);
            update_user_meta($user_id, 'memorymint_is_custodial',                 1);

        } catch (\Exception $e) {
            // Log but don't surface to client — wallet provisioning shouldn't block login
            error_log('MemoryMint custodial wallet error for user ' . $user_id . ': ' . $e->getMessage());
        }
    }

    /**
     * Return the decrypted seed phrase for a custodial (email) user.
     * Only available before the user has confirmed backup.
     */
    public function get_seed_phrase(\WP_REST_Request $request) {
        $user_id = get_current_user_id();

        if (get_user_meta($user_id, 'memorymint_wallet_backed_up', true)) {
            return new \WP_REST_Response([
                'success'   => false,
                'error'     => 'Seed phrase already backed up.',
                'backed_up' => true,
            ], 400);
        }

        $encrypted = get_user_meta($user_id, 'memorymint_custodial_mnemonic_encrypted', true);
        if (empty($encrypted)) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'No custodial wallet found.',
            ], 404);
        }

        $mnemonic = Encryption::decrypt($encrypted);
        if (!$mnemonic) {
            return new \WP_REST_Response([
                'success' => false,
                'error'   => 'Could not decrypt seed phrase.',
            ], 500);
        }

        return new \WP_REST_Response([
            'success'        => true,
            'mnemonic'       => $mnemonic,
            'wallet_address' => get_user_meta($user_id, 'memorymint_wallet_address', true) ?: '',
            'network'        => get_user_meta($user_id, 'memorymint_custodial_network', true) ?: 'preprod',
        ], 200);
    }

    /**
     * Confirm the user has backed up their seed phrase.
     * Deletes the encrypted mnemonic — the platform no longer holds it.
     */
    public function confirm_backup(\WP_REST_Request $request) {
        $user_id = get_current_user_id();

        // Idempotent — already confirmed
        if (get_user_meta($user_id, 'memorymint_wallet_backed_up', true)) {
            return new \WP_REST_Response(['success' => true], 200);
        }

        update_user_meta($user_id, 'memorymint_wallet_backed_up', current_time('mysql'));
        delete_user_meta($user_id, 'memorymint_custodial_mnemonic_encrypted');
        delete_user_meta($user_id, 'memorymint_custodial_skey_encrypted');

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * Format user data for API response.
     */
    private function format_user(\WP_User $user) {
        return [
            'id'               => $user->ID,
            'email'            => $user->user_email,
            'display_name'     => $user->display_name,
            'wallet_address'   => get_user_meta($user->ID, 'memorymint_wallet_address', true) ?: null,
            'stake_address'    => get_user_meta($user->ID, 'memorymint_stake_address', true) ?: null,
            'wallet_name'      => get_user_meta($user->ID, 'memorymint_wallet_name', true) ?: null,
            'auth_method'      => get_user_meta($user->ID, 'memorymint_auth_method', true) ?: 'unknown',
            'roles'            => $user->roles,
            'registered'       => $user->user_registered,
            'needs_seed_backup' => !get_user_meta($user->ID, 'memorymint_wallet_backed_up', true)
                                   && !empty(get_user_meta($user->ID, 'memorymint_custodial_mnemonic_encrypted', true)),
            'is_custodial'      => (bool) get_user_meta($user->ID, 'memorymint_is_custodial', true),
        ];
    }
}
