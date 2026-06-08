// Centralised rules for "Transfer Application" (relocating a just-submitted
// application to a different district / area / unit).

/** Roles permitted to transfer an application to another location. */
export const TRANSFER_ROLES = [
  'super_admin',
  'state_admin',
  'district_admin',
  'area_admin',
  'area_president',
  'unit_admin',
] as const;

/** Application statuses during which a transfer is still allowed (pre-approval). */
export const TRANSFERABLE_STATUSES = ['pending', 'under_review'] as const;

export function isTransferRole(role?: string | null): boolean {
  return !!role && (TRANSFER_ROLES as readonly string[]).includes(role);
}

export function isTransferableStatus(status?: string | null): boolean {
  return !!status && (TRANSFERABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether the given user can transfer the given application right now.
 * Requires an allowed role AND an application still in a pre-approval status.
 */
export function canTransferApplication(
  user?: { role?: string | null } | null,
  application?: { status?: string | null } | null,
): boolean {
  return isTransferRole(user?.role) && isTransferableStatus(application?.status);
}
