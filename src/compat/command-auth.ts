/**
 * Local compatibility layer for napcat on OpenClaw >= 2026.10.
 *
 * `openclaw/plugin-sdk/command-auth` was removed in 2026.10.x, taking
 * `resolveDirectDmAuthorizationOutcome` and
 * `resolveSenderCommandAuthorizationWithRuntime` with it.
 *
 * Both helpers are ported here behaviour-for-behaviour from the 2026.9.6 SDK so
 * the channel keeps its original DM/command authorization semantics. Their
 * public dependencies still exist in 2026.10 and are imported from their
 * current subpaths.
 */
import { resolveDmGroupAccessWithLists } from "openclaw/plugin-sdk/channel-policy";
import { expandAllowFromWithAccessGroups } from "openclaw/plugin-sdk/security-runtime";

export type DirectDmAuthorizationOutcome = "allowed" | "disabled" | "unauthorized";

export function resolveDirectDmAuthorizationOutcome(params: {
  isGroup: boolean;
  dmPolicy: string;
  senderAllowedForCommands: boolean;
}): DirectDmAuthorizationOutcome {
  if (params.isGroup) return "allowed";
  if (params.dmPolicy === "disabled") return "disabled";
  if (!params.senderAllowedForCommands) return "unauthorized";
  return "allowed";
}

type SenderCommandAuthorizationParams = {
  cfg: any;
  rawBody: string;
  isGroup: boolean;
  dmPolicy: string;
  channel?: string;
  accountId?: string;
  configuredAllowFrom: unknown;
  configuredGroupAllowFrom?: unknown;
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: unknown) => boolean;
  readAllowFromStore: () => Promise<unknown>;
  resolveAccessGroupMembership?: unknown;
  shouldComputeCommandAuthorized: (rawBody: string, cfg: any) => boolean;
  resolveCommandAuthorizedFromAuthorizers?: (params: {
    useAccessGroups: boolean;
    authorizers: Array<{ configured: boolean; allowed: boolean }>;
  }) => boolean;
};

async function resolveSenderCommandAuthorization(params: SenderCommandAuthorizationParams) {
  const shouldComputeAuth = params.shouldComputeCommandAuthorized(params.rawBody, params.cfg);
  const storeAllowFrom =
    !params.isGroup && params.dmPolicy !== "allowlist" && params.dmPolicy !== "open"
      ? await params.readAllowFromStore().catch(() => [])
      : [];
  const channel = params.channel;
  const accountId = params.accountId ?? "default";
  let configuredAllowFrom = params.configuredAllowFrom;
  let configuredGroupAllowFrom = params.configuredGroupAllowFrom ?? [];
  let dmStoreAllowFrom = storeAllowFrom;

  if (channel) {
    [configuredAllowFrom, configuredGroupAllowFrom] = await Promise.all([
      expandAllowFromWithAccessGroups({
        cfg: params.cfg,
        allowFrom: params.configuredAllowFrom,
        channel,
        accountId,
        senderId: params.senderId,
        isSenderAllowed: params.isSenderAllowed,
        resolveMembership: params.resolveAccessGroupMembership,
      } as any),
      expandAllowFromWithAccessGroups({
        cfg: params.cfg,
        allowFrom: params.configuredGroupAllowFrom ?? [],
        channel,
        accountId,
        senderId: params.senderId,
        isSenderAllowed: params.isSenderAllowed,
        resolveMembership: params.resolveAccessGroupMembership,
      } as any),
    ]);
    if (!params.isGroup) {
      dmStoreAllowFrom = await expandAllowFromWithAccessGroups({
        cfg: params.cfg,
        allowFrom: storeAllowFrom,
        channel,
        accountId,
        senderId: params.senderId,
        isSenderAllowed: params.isSenderAllowed,
        resolveMembership: params.resolveAccessGroupMembership,
      } as any);
    }
  }

  const access = resolveDmGroupAccessWithLists({
    isGroup: params.isGroup,
    dmPolicy: params.dmPolicy,
    groupPolicy: "allowlist",
    allowFrom: configuredAllowFrom,
    groupAllowFrom: configuredGroupAllowFrom,
    storeAllowFrom: dmStoreAllowFrom,
    isSenderAllowed: (allowFrom: unknown) => params.isSenderAllowed(params.senderId, allowFrom),
  } as any);

  const effectiveAllowFrom: unknown[] = (access as any).effectiveAllowFrom;
  const effectiveGroupAllowFrom: unknown[] = (access as any).effectiveGroupAllowFrom;
  const useAccessGroups = true;
  const senderAllowedForCommands = params.isSenderAllowed(
    params.senderId,
    params.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom,
  );
  const ownerAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveAllowFrom);
  const groupAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveGroupAllowFrom);

  return {
    shouldComputeAuth,
    effectiveAllowFrom,
    effectiveGroupAllowFrom,
    senderAllowedForCommands,
    commandAuthorized: shouldComputeAuth
      ? (params.resolveCommandAuthorizedFromAuthorizers?.({
          useAccessGroups,
          authorizers: [
            { configured: effectiveAllowFrom.length > 0, allowed: ownerAllowedForCommands },
            { configured: effectiveGroupAllowFrom.length > 0, allowed: groupAllowedForCommands },
          ],
        }) ?? senderAllowedForCommands)
      : undefined,
  };
}

export async function resolveSenderCommandAuthorizationWithRuntime(
  params: Omit<
    SenderCommandAuthorizationParams,
    "shouldComputeCommandAuthorized" | "resolveCommandAuthorizedFromAuthorizers"
  > & {
    runtime: {
      shouldComputeCommandAuthorized: SenderCommandAuthorizationParams["shouldComputeCommandAuthorized"];
      resolveCommandAuthorizedFromAuthorizers?: SenderCommandAuthorizationParams["resolveCommandAuthorizedFromAuthorizers"];
    };
  },
) {
  return resolveSenderCommandAuthorization({
    ...params,
    shouldComputeCommandAuthorized: params.runtime.shouldComputeCommandAuthorized,
    resolveCommandAuthorizedFromAuthorizers: params.runtime.resolveCommandAuthorizedFromAuthorizers,
  });
}
