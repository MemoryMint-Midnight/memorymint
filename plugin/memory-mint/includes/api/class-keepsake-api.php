<?php
namespace MemoryMint\Api;

use MemoryMint\Helpers\Validation;

if (!defined('ABSPATH')) {
    exit;
}

class KeepsakeApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/keepsakes', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'create_keepsake'],
                'permission_callback' => [$this, 'check_auth'],
                'args' => [
                    'title'             => ['required' => true,  'type' => 'string'],
                    'description'       => ['required' => false, 'type' => 'string'],
                    'privacy'           => ['required' => true,  'type' => 'string'],
                    'file_attachment_id' => ['required' => true,  'type' => 'integer'],
                    'keepsake_type'     => ['required' => false, 'type' => 'string', 'default' => 'standard'],
                    'geo_hash'          => ['required' => false, 'type' => 'string', 'default' => ''],
                    'tag_count'         => ['required' => false, 'type' => 'integer', 'default' => 0],
                ],
            ],
            [
                'methods' => 'GET',
                'callback' => [$this, 'list_keepsakes'],
                'permission_callback' => [$this, 'check_auth'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/keepsakes/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'get_keepsake'],
                'permission_callback' => [$this, 'check_auth'],
            ],
            [
                'methods' => 'PUT',
                'callback' => [$this, 'update_keepsake'],
                'permission_callback' => [$this, 'check_auth'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [$this, 'delete_keepsake'],
                'permission_callback' => [$this, 'check_auth'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/keepsakes/public', [
            'methods' => 'GET',
            'callback' => [$this, 'list_public_keepsakes'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Create a new keepsake record.
     */
    public function create_keepsake(\WP_REST_Request $request) {
        $user = wp_get_current_user();

        $title              = Validation::sanitize_title($request->get_param('title'));
        $description        = Validation::sanitize_description($request->get_param('description') ?? '');
        $privacy            = sanitize_text_field($request->get_param('privacy'));
        $file_attachment_id = intval($request->get_param('file_attachment_id'));
        $keepsake_type      = sanitize_text_field($request->get_param('keepsake_type') ?? 'standard');
        $geo_input          = sanitize_text_field($request->get_param('geo_hash') ?? '');
        $tag_count          = max(0, intval($request->get_param('tag_count') ?? 0));

        if (empty($title)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Title is required.'], 400);
        }

        if (!Validation::validate_privacy($privacy)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Invalid privacy level. Use: public, shared, or private.'], 400);
        }

        if (!in_array($keepsake_type, ['standard', 'private'], true)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'keepsake_type must be standard or private.'], 400);
        }

        // Verify file ownership
        $owner = get_post_meta($file_attachment_id, '_memorymint_user_id', true);
        if (intval($owner) !== $user->ID) {
            return new \WP_REST_Response(['success' => false, 'error' => 'You do not own this file.'], 403);
        }

        $file_url  = wp_get_attachment_url($file_attachment_id);
        $file_type = get_post_meta($file_attachment_id, '_memorymint_file_type', true) ?: 'image';
        $file_path = get_attached_file($file_attachment_id);
        $file_size = $file_path ? filesize($file_path) : 0;

        // SHA-256 of the raw file bytes — used by the Midnight contract for content authenticity proofs.
        $content_hash = ($file_path && file_exists($file_path)) ? hash_file('sha256', $file_path) : null;

        // Store SHA-256 of the geo string (64 hex chars) so the sidecar can use it directly.
        $geo_hash = !empty($geo_input) ? hash('sha256', $geo_input) : null;

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $inserted = $wpdb->insert($table, [
            'user_id'            => $user->ID,
            'title'              => $title,
            'description'        => $description,
            'privacy'            => $privacy,
            'keepsake_type'      => $keepsake_type,
            'file_attachment_id' => $file_attachment_id,
            'file_type'          => $file_type,
            'file_url'           => $file_url,
            'file_size'          => $file_size,
            'content_hash'       => $content_hash,
            'geo_hash'           => $geo_hash,
            'tag_count'          => $tag_count,
            'mint_status'        => 'pending',
            'midnight_status'    => 'pending',
            'wallet_address'     => get_user_meta($user->ID, 'memorymint_wallet_address', true) ?: '',
        ]);

        if (!$inserted) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Failed to create keepsake.'], 500);
        }

        $keepsake_id = $wpdb->insert_id;
        $keepsake = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $keepsake_id));

        return new \WP_REST_Response([
            'success' => true,
            'keepsake' => $this->format_keepsake($keepsake),
        ], 201);
    }

    /**
     * List current user's keepsakes with optional search and filter.
     */
    public function list_keepsakes(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = min(50, max(1, intval($request->get_param('per_page') ?? 20)));
        $search = sanitize_text_field($request->get_param('search') ?? '');
        $privacy = sanitize_text_field($request->get_param('privacy') ?? '');
        $status = sanitize_text_field($request->get_param('status') ?? '');

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $where = 'user_id = %d';
        $params = [$user->ID];

        if ($search) {
            $where .= ' AND (title LIKE %s OR description LIKE %s)';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $params[] = $like;
            $params[] = $like;
        }

        if ($privacy && Validation::validate_privacy($privacy)) {
            $where .= ' AND privacy = %s';
            $params[] = $privacy;
        }

        if ($status && in_array($status, ['pending', 'minting', 'minted', 'failed'])) {
            $where .= ' AND mint_status = %s';
            $params[] = $status;
        }

        $total = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE $where", ...$params));

        $offset = ($page - 1) * $per_page;
        $keepsakes = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE $where ORDER BY created_at DESC LIMIT %d OFFSET %d",
            array_merge($params, [$per_page, $offset])
        ));

        return new \WP_REST_Response([
            'success' => true,
            'keepsakes' => array_map([$this, 'format_keepsake'], $keepsakes),
            'total' => intval($total),
            'page' => $page,
            'per_page' => $per_page,
            'total_pages' => ceil($total / $per_page),
        ], 200);
    }

    /**
     * Get a single keepsake by ID.
     */
    public function get_keepsake(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $id = intval($request->get_param('id'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        return new \WP_REST_Response([
            'success' => true,
            'keepsake' => $this->format_keepsake($keepsake),
        ], 200);
    }

    /**
     * Update a keepsake (title, description, privacy).
     */
    public function update_keepsake(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $id = intval($request->get_param('id'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        $updates = [];

        $title = $request->get_param('title');
        if ($title !== null) {
            $updates['title'] = Validation::sanitize_title($title);
        }

        $description = $request->get_param('description');
        if ($description !== null) {
            $updates['description'] = Validation::sanitize_description($description);
        }

        $privacy = $request->get_param('privacy');
        if ($privacy !== null) {
            if (!Validation::validate_privacy($privacy)) {
                return new \WP_REST_Response(['success' => false, 'error' => 'Invalid privacy level.'], 400);
            }
            $updates['privacy'] = $privacy;
        }

        if (empty($updates)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'No fields to update.'], 400);
        }

        $wpdb->update($table, $updates, ['id' => $id]);

        $updated = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));

        return new \WP_REST_Response([
            'success' => true,
            'keepsake' => $this->format_keepsake($updated),
        ], 200);
    }

    /**
     * Delete a keepsake (only if not yet minted).
     */
    public function delete_keepsake(\WP_REST_Request $request) {
        $user = wp_get_current_user();
        $id = intval($request->get_param('id'));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $keepsake = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND user_id = %d",
            $id, $user->ID
        ));

        if (!$keepsake) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Keepsake not found.'], 404);
        }

        if ($keepsake->mint_status === 'minted') {
            return new \WP_REST_Response(['success' => false, 'error' => 'Cannot delete a minted keepsake.'], 400);
        }

        // Delete the WordPress media attachment (force-delete, bypasses trash)
        if (!empty($keepsake->file_attachment_id)) {
            wp_delete_attachment(intval($keepsake->file_attachment_id), true);
        }

        // Delete associated share links
        $share_table = $wpdb->prefix . 'memorymint_share_links';
        $wpdb->delete($share_table, ['keepsake_id' => $id]);

        // Delete the keepsake record
        $wpdb->delete($table, ['id' => $id]);

        return new \WP_REST_Response([
            'success' => true,
            'message' => 'Keepsake deleted.',
        ], 200);
    }

    /**
     * List public keepsakes (no auth required).
     */
    public function list_public_keepsakes(\WP_REST_Request $request) {
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = min(50, max(1, intval($request->get_param('per_page') ?? 20)));

        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';

        $total = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE privacy = 'public' AND mint_status = 'minted'");

        $offset = ($page - 1) * $per_page;
        $keepsakes = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE privacy = 'public' AND mint_status = 'minted' ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $per_page, $offset
        ));

        return new \WP_REST_Response([
            'success' => true,
            'keepsakes' => array_map([$this, 'format_keepsake'], $keepsakes),
            'total' => intval($total),
            'page' => $page,
            'total_pages' => ceil($total / $per_page),
        ], 200);
    }

    /**
     * Format keepsake for API response.
     */
    private function format_keepsake($keepsake) {
        return [
            'id'               => intval($keepsake->id),
            'user_id'          => intval($keepsake->user_id),
            'title'            => $keepsake->title,
            'description'      => $keepsake->description,
            'privacy'          => $keepsake->privacy,
            'keepsake_type'    => $keepsake->keepsake_type ?? 'standard',
            'file_type'        => $keepsake->file_type,
            'file_url'         => $keepsake->file_url,
            'thumbnail_url'    => $keepsake->thumbnail_url ?? null,
            'file_size'        => intval($keepsake->file_size),
            'content_hash'     => $keepsake->content_hash ?? null,
            'tag_count'        => intval($keepsake->tag_count ?? 0),
            'tx_hash'          => $keepsake->tx_hash,
            'asset_id'         => $keepsake->asset_id,
            'policy_id'        => $keepsake->policy_id,
            'mint_status'      => $keepsake->mint_status,
            'midnight_address' => $keepsake->midnight_address ?? null,
            'midnight_status'  => $keepsake->midnight_status ?? 'pending',
            'service_fee_paid' => floatval($keepsake->service_fee_paid),
            'network_fee_ada'  => floatval($keepsake->network_fee_ada),
            'wallet_address'   => $keepsake->wallet_address,
            'created_at'       => $keepsake->created_at,
            'updated_at'       => $keepsake->updated_at,
        ];
    }

    public function check_auth(\WP_REST_Request $request) {
        $auth_api = new AuthApi();
        return $auth_api->check_auth($request);
    }
}
