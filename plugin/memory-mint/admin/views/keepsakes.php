<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$table = $wpdb->prefix . 'memorymint_keepsakes';

$page_num = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
$per_page = 20;
$offset = ($page_num - 1) * $per_page;
$search = isset($_GET['s']) ? sanitize_text_field($_GET['s']) : '';
$status_filter = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';

$where = '1=1';
$params = [];

if ($search) {
    $where .= ' AND (k.title LIKE %s OR u.user_email LIKE %s)';
    $params[] = '%' . $wpdb->esc_like($search) . '%';
    $params[] = '%' . $wpdb->esc_like($search) . '%';
}

if ($status_filter && in_array($status_filter, ['pending', 'minting', 'minted', 'failed'])) {
    $where .= ' AND k.mint_status = %s';
    $params[] = $status_filter;
}

$total = $wpdb->get_var(
    $params
        ? $wpdb->prepare("SELECT COUNT(*) FROM $table k LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID WHERE $where", ...$params)
        : "SELECT COUNT(*) FROM $table k LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID WHERE $where"
);

$keepsakes = $wpdb->get_results(
    $params
        ? $wpdb->prepare("SELECT k.*, u.user_email FROM $table k LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID WHERE $where ORDER BY k.created_at DESC LIMIT %d OFFSET %d", array_merge($params, [$per_page, $offset]))
        : $wpdb->prepare("SELECT k.*, u.user_email FROM $table k LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID WHERE $where ORDER BY k.created_at DESC LIMIT %d OFFSET %d", $per_page, $offset)
);

$total_pages = ceil($total / $per_page);

$explorer_base = get_option('memorymint_network', 'preprod') === 'mainnet'
    ? 'https://cardanoscan.io'
    : 'https://preprod.cardanoscan.io';
?>

<div class="wrap memorymint-admin">
    <h1>All Keepsakes <span class="count">(<?php echo intval($total); ?>)</span></h1>

    <div class="tablenav top">
        <form method="get" style="display: inline-block;">
            <input type="hidden" name="page" value="memory-mint-keepsakes" />
            <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Search by title or email..." />
            <select name="status">
                <option value="">All Statuses</option>
                <option value="pending" <?php selected($status_filter, 'pending'); ?>>Pending</option>
                <option value="minting" <?php selected($status_filter, 'minting'); ?>>Minting</option>
                <option value="minted" <?php selected($status_filter, 'minted'); ?>>Minted</option>
                <option value="failed" <?php selected($status_filter, 'failed'); ?>>Failed</option>
            </select>
            <input type="submit" class="button" value="Filter" />
        </form>
    </div>

    <table class="wp-list-table widefat fixed striped">
        <thead>
            <tr>
                <th style="width:40px">ID</th>
                <th>Title</th>
                <th>User</th>
                <th>Privacy</th>
                <th>Type</th>
                <th>Status</th>
                <th>TX Hash</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($keepsakes)): ?>
                <tr><td colspan="8">No keepsakes found.</td></tr>
            <?php else: ?>
                <?php foreach ($keepsakes as $k): ?>
                    <tr>
                        <td><?php echo intval($k->id); ?></td>
                        <td><strong><?php echo esc_html($k->title); ?></strong></td>
                        <td><?php echo esc_html($k->user_email ?? 'Unknown'); ?></td>
                        <td><?php echo esc_html(ucfirst($k->privacy)); ?></td>
                        <td><?php echo esc_html($k->file_type ?? '—'); ?></td>
                        <td>
                            <span class="memorymint-status memorymint-status-<?php echo esc_attr($k->mint_status); ?>">
                                <?php echo esc_html(ucfirst($k->mint_status)); ?>
                            </span>
                        </td>
                        <td>
                            <?php if ($k->tx_hash): ?>
                                <a href="<?php echo esc_url($explorer_base); ?>/transaction/<?php echo esc_attr($k->tx_hash); ?>" target="_blank">
                                    <?php echo esc_html(substr($k->tx_hash, 0, 16) . '...'); ?>
                                </a>
                            <?php else: ?>
                                —
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html(date('M j, Y', strtotime($k->created_at))); ?></td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>

    <?php if ($total_pages > 1): ?>
        <div class="tablenav bottom">
            <div class="tablenav-pages">
                <?php
                echo paginate_links([
                    'base' => add_query_arg('paged', '%#%'),
                    'format' => '',
                    'current' => $page_num,
                    'total' => $total_pages,
                ]);
                ?>
            </div>
        </div>
    <?php endif; ?>
</div>
