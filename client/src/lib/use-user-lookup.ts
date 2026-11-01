import { useQuery } from "@tanstack/react-query";
import { API } from "./api";

/**
 * Resolve display names/avatars for a set of user ids via the public
 * user-lookup endpoint (P0-3: the full /api/users list is admin-only now).
 * Returns a getter function: lookup(id) -> { id, name, role, avatar } | undefined.
 */
export function useUserLookup(ids: (number | undefined | null)[]) {
  const unique = ids
    .filter((n): n is number => typeof n === "number" && n > 0)
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .sort((a, b) => a - b);
  const { data } = useQuery({
    queryKey: ["/api/users/lookup", unique.join(",")],
    queryFn: () => API.lookupUsers(unique),
    enabled: unique.length > 0,
  });
  const map = new Map((data || []).map((u) => [u.id, u]));
  return (id: number | undefined | null) => (id == null ? undefined : map.get(id));
}
