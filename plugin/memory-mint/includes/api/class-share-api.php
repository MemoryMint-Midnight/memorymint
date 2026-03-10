<?php
namespace MemoryMint\Api;

if (!defined('ABSPATH')) {
    exit;
}

class ShareApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/share/create', [
            'methods' => 'POST',
            'callback' => [$this, 'create_share_link'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'keepsake_id' => ['required' => true, 'type' => 'integer'],
                'expires_days' => ['required' => false, 'type' => 'integer'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/share/email', [
            'methods' => 'POST',
            'callback' => [$this, 'send_email_invite'],
            'permission_callback' => [$this, 'check_auth'],
            'args' => [
                'keepsake_id' => ['required' => true, 'type' => 'integer'],
                'recipient_email' => ['required' => true, 'type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/share/(?P<token>[a-f0-9]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'access_share'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/share/(?P<id>\d+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'revoke_share'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/share/list/(?P<keepsake_id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'list_shares'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * Generate a share link for a keepsake.
     */
    public function create_share_link(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $expires_days = intval($request->get_param('expires_days') ?? 0);

        // Verify keepsake ownership
        global $wpdb;
        $keepsake_table = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $keepsake_table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        $token = bin2hex(random_bytes(32));
        $expires_at = $expires_days > 0
            ? date('Y-m-d H:i:s', time() + ($expires_days * DAY_IN_SECONDS))
            : null;

        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $wpdb->insert($share_table, [
            'keepsake_id' => $keepsake_id,
            'share_token' => $token,
            'share_type' => 'link',
            'created_by' => $user->ID,
            'expires_at' => $expires_at,
        ]);

        $share_url = $this->build_share_url($token);

        return new \WP_REST_Response([
            'success' => true,
            'share_id' => $wpdb->insert_id,
            'share_url' => $share_url,
            'token' => $token,
            'expires_at' => $expires_at,
        ], 201);
    }

    /**
     * Send a share link via email.
     */
    public function send_email_invite(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));
        $recipient_email = sanitize_email($request->get_param('recipient_email'));

        if (!is_email($recipient_email)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Valid email address required.'], 400);
        }

        // Verify keepsake ownership
        global $wpdb;
        $keepsake_table = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $keepsake_table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        $token = bin2hex(random_bytes(32));
        $share_url = $this->build_share_url($token);

        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $wpdb->insert($share_table, [
            'keepsake_id' => $keepsake_id,
            'share_token' => $token,
            'share_type' => 'email',
            'recipient_email' => $recipient_email,
            'created_by' => $user->ID,
        ]);

        // Send the email
        $sender_name = $user->display_name ?: 'Someone';
        $subject = "{$sender_name} shared a memory with you on Memory Mint";
        $body = $this->build_email_body($sender_name, $keepsake->title, $share_url);

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: Memory Mint <noreply@memorymint.io>',
        ];

        $sent = wp_mail($recipient_email, $subject, $body, $headers);

        return new \WP_REST_Response([
            'success' => true,
            'email_sent' => $sent,
            'share_url' => $share_url,
            'recipient' => $recipient_email,
        ], 201);
    }

    /**
     * Access a shared keepsake (public, no auth).
     */
    public function access_share(\WP_REST_Request $request) {
        $token = sanitize_text_field($request->get_param('token'));

        // Token must be exactly 64 lowercase hex chars — reject anything else immediately
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid share token.'], 400);
        }

        // Rate limit: 60 lookups per minute per IP
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip) {
            $rate_key = 'memorymint_share_rate_' . md5($ip);
            $hits     = (int) get_transient($rate_key);
            if ($hits >= 60) {
                return new \WP_REST_Response([
                    'success' => false,
                    'error'   => 'Too many requests. Please try again in a moment.',
                ], 429);
            }
            set_transient($rate_key, $hits + 1, MINUTE_IN_SECONDS);
        }

        $gallery_api = new GalleryApi();
        return $gallery_api->shared_keepsake($request);
    }

    /**
     * Revoke a share link.
     */
    public function revoke_share(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $share_id = intval($request->get_param('id'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_share_links';

        $share = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND created_by = %d",
            $share_id, $user->ID
        ));

        if (!$share) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Share link not found.'], 404);
        }

        $wpdb->update($table, ['is_active' => 0], ['id' => $share_id]);

        return new \WP_REST_Response([
            'success' => true,
            'message' => 'Share link revoked.',
        ], 200);
    }

    /**
     * List all share links for a keepsake.
     */
    public function list_shares(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $keepsake_id = intval($request->get_param('keepsake_id'));

        // Verify ownership
        global $wpdb;
        $keepsake_table = $wpdb->prefix . 'memorymint_keepsakes';
        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $keepsake_table WHERE id = %d AND user_id = %d",
            $keepsake_id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $shares = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $share_table WHERE keepsake_id = %d ORDER BY created_at DESC",
            $keepsake_id
        ));

        $formatted = array_map(function ($s) {
            return [
                'id' => intval($s->id),
                'share_type' => $s->share_type,
                'share_url' => $this->build_share_url($s->share_token),
                'recipient_email' => $s->recipient_email,
                'is_active' => (bool) $s->is_active,
                'accessed_count' => intval($s->accessed_count),
                'expires_at' => $s->expires_at,
                'created_at' => $s->created_at,
            ];
        }, $shares);

        return new \WP_REST_Response([
            'success' => true,
            'shares' => $formatted,
        ], 200);
    }

    /**
     * Build the frontend share URL.
     */
    private function build_share_url($token) {
        $production_url = get_option('memorymint_production_url', '');
        $base = $production_url ?: 'http://localhost:3000';
        return rtrim($base, '/') . '/share/?token=' . $token;
    }

    /**
     * Build the share invitation email body.
     */
    private function build_email_body($sender_name, $keepsake_title, $share_url) {
        return "
        <div style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #ede4d8; padding: 32px; border-radius: 12px;'>
            <div style='text-align: center; margin-bottom: 24px;'>
                <h1 style='color: #333; font-size: 24px; margin: 0;'>Memory Mint</h1>
                <p style='color: #666; font-size: 14px;'>Mint a moment. Keep it forever.</p>
            </div>

            <div style='background: white; padding: 24px; border-radius: 8px; text-align: center;'>
                <h2 style='color: #333; font-size: 20px;'>{$sender_name} shared a memory with you</h2>
                <p style='color: #666; font-size: 16px; margin: 16px 0;'>\"{$keepsake_title}\"</p>
                <a href='{$share_url}'
                   style='display: inline-block; background: #ffbd59; color: #333; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px;'>
                    View Memory
                </a>
            </div>

            <p style='text-align: center; color: #999; font-size: 12px; margin-top: 24px;'>
                This memory was shared with you via Memory Mint. No account required to view.
            </p>
        </div>";
    }

    public function check_auth(\WP_REST_Request $request) {
        $auth_api = new AuthApi();
        return $auth_api->check_auth($request);
    }
}
