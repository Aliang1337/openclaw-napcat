import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
import { normalizeSecretInputString } from "openclaw/plugin-sdk/secret-input";
import type { NapCatAccountConfig, NapCatConfig, ResolvedNapCatAccount } from "./types.js";

function getNapCatSection(cfg: OpenClawConfig): NapCatConfig | undefined {
  return  (cfg as { channels?: { napcat?: unknown } }).channels?.napcat as NapCatConfig | undefined;
}

function mergeNapCatAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): NapCatAccountConfig {
  const section = getNapCatSection(cfg);
  if (!section) return {};

  const base: NapCatAccountConfig = {
    name: section.name,
    enabled: section.enabled,
    httpApi: section.httpApi,
    accessToken: section.accessToken,
    selfId: section.selfId,
    dmPolicy: section.dmPolicy,
    allowFrom: section.allowFrom,
    groupPolicy: section.groupPolicy,
    groupAllowFrom: section.groupAllowFrom,
    mediaMaxMb: section.mediaMaxMb,
    responsePrefix: section.responsePrefix,
  };

  if (accountId === DEFAULT_ACCOUNT_ID) {
    return base;
  }

  const accountConfig = section.accounts?.[accountId];
  if (!accountConfig) return base;

  // Account-level overrides base-level
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(accountConfig).filter(([, v]) => v !== undefined),
    ),
  };
}

export function resolveNapCatAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedNapCatAccount {
  const accountId = normalizeAccountId(params.accountId);
  const config = mergeNapCatAccountConfig(params.cfg, accountId);
  const section = getNapCatSection(params.cfg);

  const baseEnabled = section?.enabled !== false;
  const accountEnabled = config.enabled !== false;
  const enabled = baseEnabled && accountEnabled;

  const httpApi = (config.httpApi ?? "").trim();
  const accessToken = normalizeSecretInputString(config.accessToken) ?? "";
  const selfId = String(config.selfId ?? "").trim();

  return {
    accountId,
    name: config.name?.trim(),
    enabled,
    httpApi,
    accessToken,
    selfId,
    config,
  };
}

export function listNapCatAccountIds(cfg: OpenClawConfig): string[] {
  const section = getNapCatSection(cfg);
  if (!section) return [];

  const ids = new Set<string>();
  // Base config counts as default account
  if (section.httpApi || section.accessToken || section.selfId) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  if (section.accounts) {
    for (const id of Object.keys(section.accounts)) {
      ids.add(normalizeAccountId(id));
    }
  }
  if (ids.size === 0) ids.add(DEFAULT_ACCOUNT_ID);
  return [...ids];
}

export function resolveDefaultNapCatAccountId(cfg: OpenClawConfig): string {
  const section = getNapCatSection(cfg);
  if (section?.defaultAccount) {
    return normalizeAccountId(section.defaultAccount);
  }
  return DEFAULT_ACCOUNT_ID;
}
