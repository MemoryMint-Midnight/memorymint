<?php
namespace MemoryMint\Api;

if (!defined('ABSPATH')) {
    exit;
}

class GalleryApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/gallery/public', [
            'methods' => 'GET',
            'callback' => [$this, 'public_feed'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/gallery/shared/(?P<token>[a-f0-9]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'shared_keepsake'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Public memory feed — all public minted keepsakes.
     */
    public function public_feed(\WP_REST_Request $request) {
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = min(50, max(1, intval($request->get_param('per_page') ?? 20)));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $total = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE privacy = 'public' AND mint_status = 'minted'");

        $offset = ($page - 1) * $per_page;
        $keepsakes = $wpdb->get_results($wpdb->prepare(
            "SELECT k.*, u.display_name as creator_name
             FROM $table k
             LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID
             WHERE k.privacy = 'public' AND k.mint_status = 'minted'
             ORDER BY k.created_at DESC
             LIMIT %d OFFSET %d",
            $per_page, $offset
        ));

        $formatted = array_map(function ($k) {
            return [
                'id' => intval($k->id),
                'title' => $k->title,
                'description' => $k->description,
                'file_type' => $k->file_type,
                'file_url' => $k->file_url,
                'tx_hash' => $k->tx_hash,
                'creator_name' => $k->creator_name ?? 'Anonymous',
                'created_at' => $k->created_at,
            ];
        }, $keepsakes);

        return new \WP_REST_Response([
            'success' => true,
            'keepsakes' => $formatted,
            'total' => intval($total),
            'page' => $page,
            'total_pages' => ceil($total / $per_page),
        ], 200);
    }

    /**
     * View a shared keepsake by token.
     */
    public function shared_keepsake(\WP_REST_Request $request) {
        $token = sanitize_text_field($request->get_param('token'));

        global $wpdb;
        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $keepsake_table = $wpdb->prefix . 'memorymint_keepsakes';

        $share = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $share_table WHERE share_token = %s AND is_active = 1",
            $token
        ));

        if (!$share) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Share link not found or has been revoked.'], 404);
        }

        // Check expiration
        if ($share->expires_at && strtotime($share->expires_at) < time()) {
            return new \WP_REST_Response(['success' => false, 'error' => 'This share link has expired.'], 410);
        }

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT k.*, u.display_name as creator_name
             FROM $keepsake_table k
             LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID
             WHERE k.id = %d",
            $share->keepsake_id
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        // Increment access count
        $wpdb->query($wpdb->prepare(
            "UPDATE $share_table SET accessed_count = accessed_count + 1 WHERE id = %d",
            $share->id
        ));

        return new \WP_REST_Response([
            'success' => true,
            'keepsake' => [
                'id' => intval($keepsake->id),
                'title' => $keepsake->title,
                'description' => $keepsake->description,
                'file_type' => $keepsake->file_type,
                'file_url' => $keepsake->file_url,
                'privacy' => $keepsake->privacy,
                'tx_hash' => $keepsake->tx_hash,
                'creator_name' => $keepsake->creator_name ?? 'Anonymous',
                'created_at' => $keepsake->created_at,
            ],
        ], 200);
    }
}
