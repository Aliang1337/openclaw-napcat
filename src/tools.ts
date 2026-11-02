import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { ChannelAgentTool as StrictChannelAgentTool } from "openclaw/plugin-sdk/channel-contract";

type ChannelAgentTool = Omit<StrictChannelAgentTool, "execute"> & {
  ownerOnly?: boolean;
  execute?: (
    toolCallId: string,
    params: any,
    signal?: any,
    onUpdate?: any,
  ) => Promise<any>;
};
import { callOneBotApi, sendGroupMsg, sendPrivateMsg, textSegment, imageSegment, recordSegment, videoSegment, uploadGroupFile, uploadPrivateFile } from "./api.js";
import { resolveNapCatAccount } from "./accounts.js";

// ---------------------------------------------------------------------------
// Helpers — plain JSON Schema objects (no typebox to avoid jiti dual-instance)
// ---------------------------------------------------------------------------

function resolveHttpApi(cfg: OpenClawConfig): { httpApi: string; accessToken?: string } {
  const account = resolveNapCatAccount({ cfg });
  return { httpApi: account.httpApi, accessToken: account.accessToken };
}

function numberProp(description: string, extra?: Record<string, unknown>) {
  return { type: "number" as const, description, ...extra };
}

function optionalNumberProp(description: string, extra?: Record<string, unknown>) {
  return { type: "number" as const, description, ...extra };
}

function stringProp(description: string) {
  return { type: "string" as const, description };
}

function booleanProp(description: string) {
  return { type: "boolean" as const, description };
}

function objectSchema(
  properties: Record<string, unknown>,
  required: string[],
) {
  return { type: "object" as const, properties, required };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Give a QQ user a "like" (thumbs-up). */
export function createQQLikeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Like User",
    name: "qq_like_user",
    ownerOnly: false,
    description:
      "Give a QQ user a thumbs-up (like/praise). Provide the target QQ number and how many times to like (1-10). When a user @mentions someone, extract the QQ number from @QQNumber in the message.",
    parameters: objectSchema(
      {
        user_id: numberProp("Target QQ number"),
        times: optionalNumberProp("Number of likes, 1-10, default 10", { minimum: 1, maximum: 10 }),
      },
      ["user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id, times = 10 } = args as { user_id: number; times?: number };
      await callOneBotApi(httpApi, "send_like", { user_id, times }, { accessToken });
      return {
        content: [{ type: "text" as const, text: `Successfully liked user ${user_id} ${times} time(s).` }],
      };
    },
  };
}

/** Get a QQ user's profile info (stranger info). */
export function createQQGetUserInfoTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get User Info",
    name: "qq_get_user_info",
    ownerOnly: false,
    description:
      "Get a QQ user's profile information including nickname, age, sex, signature, level, etc. Useful for analyzing a person's profile. When a user @mentions someone, extract the QQ number from @QQNumber in the message.",
    parameters: objectSchema(
      { user_id: numberProp("Target QQ number") },
      ["user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id } = args as { user_id: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi,
        "get_stranger_info",
        { user_id, no_cache: true },
        { accessToken },
      );
      const info = resp.data;
      const lines = [
        `QQ: ${info.user_id}`,
        `Nickname: ${info.nickname ?? "unknown"}`,
        info.sex ? `Sex: ${info.sex}` : null,
        info.age ? `Age: ${info.age}` : null,
        info.sign ? `Signature: ${info.sign}` : null,
        info.level ? `Level: ${info.level}` : null,
        info.login_days ? `Login days: ${info.login_days}` : null,
        info.qid ? `QID: ${info.qid}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [{ type: "text" as const, text: lines }] };
    },
  };
}

/** Get group info. */
export function createQQGetGroupInfoTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Info",
    name: "qq_get_group_info",
    ownerOnly: false,
    description: "Get QQ group information including name, member count, etc.",
    parameters: objectSchema(
      { group_id: numberProp("Target group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi,
        "get_group_info",
        { group_id, no_cache: true },
        { accessToken },
      );
      const g = resp.data;
      const lines = [
        `Group: ${g.group_id}`,
        `Name: ${g.group_name ?? "unknown"}`,
        g.member_count ? `Members: ${g.member_count}` : null,
        g.max_member_count ? `Max members: ${g.max_member_count}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [{ type: "text" as const, text: lines }] };
    },
  };
}

/** Get group member info. */
export function createQQGetGroupMemberInfoTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Member Info",
    name: "qq_get_group_member_info",
    ownerOnly: false,
    description:
      "Get a specific member's info within a QQ group, including card name, role, join time, last active time, title, etc. When a user @mentions someone, extract the QQ number from @QQNumber in the message.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number"),
      },
      ["group_id", "user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id } = args as { group_id: number; user_id: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi,
        "get_group_member_info",
        { group_id, user_id, no_cache: true },
        { accessToken },
      );
      const m = resp.data;
      const lines = [
        `QQ: ${m.user_id}`,
        `Nickname: ${m.nickname ?? "unknown"}`,
        m.card ? `Card: ${m.card}` : null,
        m.role ? `Role: ${m.role}` : null,
        m.title ? `Title: ${m.title}` : null,
        m.join_time ? `Joined: ${new Date((m.join_time as number) * 1000).toISOString()}` : null,
        m.last_sent_time
          ? `Last active: ${new Date((m.last_sent_time as number) * 1000).toISOString()}`
          : null,
        m.level ? `Level: ${m.level}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [{ type: "text" as const, text: lines }] };
    },
  };
}

/** Mute a group member. */
export function createQQMuteGroupMemberTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Mute Group Member",
    name: "qq_mute_group_member",
    ownerOnly: true,
    description:
      "Mute (ban) a member in a QQ group for a specified duration. Set duration to 0 to unmute. The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number to mute"),
        duration: optionalNumberProp("Mute duration in seconds (0 = unmute, default 600)", { minimum: 0 }),
      },
      ["group_id", "user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id, duration = 600 } = args as {
        group_id: number;
        user_id: number;
        duration?: number;
      };
      await callOneBotApi(
        httpApi,
        "set_group_ban",
        { group_id, user_id, duration },
        { accessToken },
      );
      const action = duration === 0 ? "unmuted" : `muted for ${duration}s`;
      return {
        content: [{ type: "text" as const, text: `User ${user_id} has been ${action} in group ${group_id}.` }],
      };
    },
  };
}

/** Kick a member from a group. */
export function createQQKickGroupMemberTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Kick Group Member",
    name: "qq_kick_group_member",
    ownerOnly: true,
    description: "Remove (kick) a member from a QQ group. The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number to kick"),
        reject_add_request: booleanProp("Whether to reject future join requests from this user"),
      },
      ["group_id", "user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id, reject_add_request = false } = args as {
        group_id: number;
        user_id: number;
        reject_add_request?: boolean;
      };
      await callOneBotApi(
        httpApi,
        "set_group_kick",
        { group_id, user_id, reject_add_request },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `User ${user_id} has been kicked from group ${group_id}.` }],
      };
    },
  };
}

/** Send a poke/nudge to a user. */
export function createQQPokeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Poke",
    name: "qq_poke",
    ownerOnly: false,
    description: "Send a poke (nudge) to a QQ user in a group or private chat. The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        user_id: numberProp("Target QQ number to poke"),
        group_id: optionalNumberProp("Group number (omit for private poke)"),
      },
      ["user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id, group_id } = args as { user_id: number; group_id?: number };
      if (group_id) {
        await callOneBotApi(httpApi, "group_poke", { group_id, user_id }, { accessToken });
      } else {
        await callOneBotApi(httpApi, "friend_poke", { user_id }, { accessToken });
      }
      return {
        content: [{ type: "text" as const, text: `Poked user ${user_id}${group_id ? ` in group ${group_id}` : ""}.` }],
      };
    },
  };
}

/** Recall (delete) a sent message. */
export function createQQRecallMessageTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Recall Message",
    name: "qq_recall_message",
    ownerOnly: true,
    description: "Recall (unsend/delete) a message by its message ID.",
    parameters: objectSchema(
      { message_id: numberProp("Message ID to recall") },
      ["message_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { message_id } = args as { message_id: number };
      await callOneBotApi(httpApi, "delete_msg", { message_id }, { accessToken });
      return {
        content: [{ type: "text" as const, text: `Message ${message_id} has been recalled.` }],
      };
    },
  };
}

/** Set group member card (nickname in group). */
export function createQQSetGroupCardTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Card",
    name: "qq_set_group_card",
    ownerOnly: true,
    description: "Set a member's card (display name) in a QQ group. The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number"),
        card: stringProp("New card name (empty string to clear)"),
      },
      ["group_id", "user_id", "card"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id, card } = args as { group_id: number; user_id: number; card: string };
      await callOneBotApi(
        httpApi,
        "set_group_card",
        { group_id, user_id, card },
        { accessToken },
      );
      return {
        content: [
          { type: "text" as const, text: `Set user ${user_id}'s card to "${card}" in group ${group_id}.` },
        ],
      };
    },
  };
}

/** Get bot's friend list. */
export function createQQGetFriendListTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Friend List",
    name: "qq_get_friend_list",
    ownerOnly: false,
    description:
      "Get the bot's full friend list. Returns each friend's QQ number, nickname, and remark. When a user mentions someone by @QQNumber, you can use this to find matching friends.",
    parameters: objectSchema({}, []),
    execute: async (_toolCallId, _args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const resp = await callOneBotApi<Array<Record<string, unknown>>>(
        httpApi,
        "get_friend_list",
        {},
        { accessToken },
      );
      const friends = resp.data;
      const lines = friends.map(
        (f) => `${f.user_id} | ${f.nickname ?? ""}${f.remark ? ` (${f.remark})` : ""}`,
      );
      return {
        content: [{ type: "text" as const, text: `Friends (${friends.length}):\n${lines.join("\n")}` }],
      };
    },
  };
}

/** Get bot's group list. */
export function createQQGetGroupListTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group List",
    name: "qq_get_group_list",
    ownerOnly: false,
    description:
      "Get the bot's full group list. Returns each group's ID, name, and member count.",
    parameters: objectSchema({}, []),
    execute: async (_toolCallId, _args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const resp = await callOneBotApi<Array<Record<string, unknown>>>(
        httpApi,
        "get_group_list",
        {},
        { accessToken },
      );
      const groups = resp.data;
      const lines = groups.map(
        (g) => `${g.group_id} | ${g.group_name ?? "unknown"} | ${g.member_count ?? "?"} members`,
      );
      return {
        content: [{ type: "text" as const, text: `Groups (${groups.length}):\n${lines.join("\n")}` }],
      };
    },
  };
}

/** Get all members of a group. */
export function createQQGetGroupMemberListTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Member List",
    name: "qq_get_group_member_list",
    ownerOnly: false,
    description:
      "Get the full member list of a QQ group. Returns each member's QQ number, nickname, card, and role. Useful for resolving @QQNumber mentions to real names.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Array<Record<string, unknown>>>(
        httpApi,
        "get_group_member_list",
        { group_id },
        { accessToken },
      );
      const members = resp.data;
      const lines = members.map(
        (m) =>
          `${m.user_id} | ${m.card || m.nickname || "unknown"} | ${m.role ?? "member"}`,
      );
      return {
        content: [
          { type: "text" as const, text: `Group ${group_id} members (${members.length}):\n${lines.join("\n")}` },
        ],
      };
    },
  };
}

/** Set/unset group admin. */
export function createQQSetGroupAdminTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Admin",
    name: "qq_set_group_admin",
    ownerOnly: true,
    description:
      "Set or unset a member as group admin in a QQ group. The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number"),
        enable: booleanProp("true = set as admin, false = remove admin"),
      },
      ["group_id", "user_id", "enable"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id, enable } = args as {
        group_id: number;
        user_id: number;
        enable: boolean;
      };
      await callOneBotApi(
        httpApi,
        "set_group_admin",
        { group_id, user_id, enable },
        { accessToken },
      );
      const action = enable ? "promoted to admin" : "removed from admin";
      return {
        content: [{ type: "text" as const, text: `User ${user_id} has been ${action} in group ${group_id}.` }],
      };
    },
  };
}

/** Change group name. */
export function createQQSetGroupNameTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Name",
    name: "qq_set_group_name",
    ownerOnly: true,
    description: "Change the name of a QQ group.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        group_name: stringProp("New group name"),
      },
      ["group_id", "group_name"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, group_name } = args as { group_id: number; group_name: string };
      await callOneBotApi(
        httpApi,
        "set_group_name",
        { group_id, group_name },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `Group ${group_id} name changed to "${group_name}".` }],
      };
    },
  };
}

/** Toggle whole-group mute. */
export function createQQSetGroupWholeBanTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Whole Ban",
    name: "qq_set_group_whole_ban",
    ownerOnly: true,
    description: "Enable or disable whole-group mute (all members muted). Only admins/owners can speak when enabled.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        enable: booleanProp("true = mute all, false = unmute all"),
      },
      ["group_id", "enable"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, enable } = args as { group_id: number; enable: boolean };
      await callOneBotApi(
        httpApi,
        "set_group_whole_ban",
        { group_id, enable },
        { accessToken },
      );
      const action = enable ? "enabled" : "disabled";
      return {
        content: [{ type: "text" as const, text: `Whole-group mute ${action} for group ${group_id}.` }],
      };
    },
  };
}

/** Send a group announcement/notice. */
export function createQQSendGroupNoticeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Send Group Notice",
    name: "qq_send_group_notice",
    ownerOnly: true,
    description: "Send a group announcement/notice in a QQ group. Requires admin or owner permission.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        content: stringProp("Announcement content text"),
      },
      ["group_id", "content"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, content } = args as { group_id: number; content: string };
      await callOneBotApi(
        httpApi,
        "_send_group_notice",
        { group_id, content },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `Group notice sent to group ${group_id}.` }],
      };
    },
  };
}

/** Get group honor/achievements info. */
export function createQQGetGroupHonorInfoTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Honor Info",
    name: "qq_get_group_honor_info",
    ownerOnly: false,
    description:
      "Get group honor/achievement info (talkative, performer, legend, strong newbie, emotion). Use type='all' for everything.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        type: stringProp("Honor type: talkative, performer, legend, strong_newbie, emotion, or all"),
      },
      ["group_id", "type"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, type } = args as { group_id: number; type: string };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi,
        "get_group_honor_info",
        { group_id, type },
        { accessToken },
      );
      const data = resp.data;
      const sections: string[] = [`Group ${group_id} Honor Info:`];
      // Current talkative
      if (data.current_talkative) {
        const t = data.current_talkative as Record<string, unknown>;
        sections.push(`Dragon King: ${t.nickname ?? t.user_id} (${t.day_count} days)`);
      }
      // List-type honors
      for (const key of ["talkative_list", "performer_list", "legend_list", "strong_newbie_list", "emotion_list"]) {
        const list = data[key] as Array<Record<string, unknown>> | undefined;
        if (list && list.length > 0) {
          const label = key.replace(/_list$/, "").replace(/_/g, " ");
          sections.push(`\n${label}:`);
          for (const entry of list.slice(0, 10)) {
            sections.push(`  ${entry.nickname ?? entry.user_id} — ${entry.description ?? ""}`);
          }
        }
      }
      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  };
}

/** Send a message (text/image/voice/video) to a QQ user or group. */
export function createQQSendMessageTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Send Message",
    name: "qq_send_message",
    ownerOnly: true,
    description:
      "Send a message to a specific QQ user or group. Supports text, image, voice (record), and video. " +
      "For image/voice/video, provide a file URL or local path. " +
      "target format: 'group:<group_id>' or 'private:<user_id>'. " +
      "Examples: target='group:123456' sends to group, target='private:789012' sends to user.",
    parameters: objectSchema(
      {
        target: stringProp("Target in format 'group:<group_id>' or 'private:<user_id>'"),
        text: stringProp("Text content to send (optional if media is provided)"),
        image_url: stringProp("Image file URL or local path (optional)"),
        voice_url: stringProp("Voice/audio file URL or local path — sent as QQ voice message (optional)"),
        video_url: stringProp("Video file URL or local path (optional)"),
      },
      ["target"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { target, text, image_url, voice_url, video_url } = args as {
        target: string;
        text?: string;
        image_url?: string;
        voice_url?: string;
        video_url?: string;
      };

      const isGroup = target.startsWith("group:");
      const id = Number(target.replace(/^(private|group):/, ""));
      if (Number.isNaN(id)) {
        return { content: [{ type: "text" as const, text: `Invalid target: ${target}` }] };
      }

      const send = async (segments: import("./types.js").OneBotSegment[]) => {
        if (isGroup) {
          await sendGroupMsg(httpApi, id, segments, accessToken);
        } else {
          await sendPrivateMsg(httpApi, id, segments, accessToken);
        }
      };

      // Text + image can be sent together
      const textImageSegments: import("./types.js").OneBotSegment[] = [];
      if (image_url?.trim()) textImageSegments.push(imageSegment(image_url.trim()));
      if (text?.trim()) textImageSegments.push(textSegment(text.trim()));
      if (textImageSegments.length > 0) await send(textImageSegments);

      // Voice must be sent alone
      if (voice_url?.trim()) await send([recordSegment(voice_url.trim())]);

      // Video must be sent alone
      if (video_url?.trim()) await send([videoSegment(video_url.trim())]);

      return {
        content: [{ type: "text" as const, text: `Message sent to ${target}.` }],
      };
    },
  };
}

/** Upload a file (pdf, doc, zip, etc.) to a QQ user or group. */
export function createQQUploadFileTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Upload File",
    name: "qq_upload_file",
    ownerOnly: true,
    description:
      "Upload a file to a QQ group or private chat. Supports any file type (pdf, doc, zip, mp3, etc.). " +
      "Provide the file URL or local path and the display name. " +
      "target format: 'group:<group_id>' or 'private:<user_id>'.",
    parameters: objectSchema(
      {
        target: stringProp("Target in format 'group:<group_id>' or 'private:<user_id>'"),
        file: stringProp("File URL or local file path to upload"),
        name: stringProp("Display file name (e.g. 'report.pdf')"),
      },
      ["target", "file", "name"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { target, file, name } = args as { target: string; file: string; name: string };

      const isGroup = target.startsWith("group:");
      const id = Number(target.replace(/^(private|group):/, ""));
      if (Number.isNaN(id)) {
        return { content: [{ type: "text" as const, text: `Invalid target: ${target}` }] };
      }

      if (isGroup) {
        await uploadGroupFile(httpApi, id, file, name, accessToken);
      } else {
        await uploadPrivateFile(httpApi, id, file, name, accessToken);
      }

      return {
        content: [{ type: "text" as const, text: `File "${name}" uploaded to ${target}.` }],
      };
    },
  };
}

/** Forward messages to another group or user. */
export function createQQForwardMessageTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Forward Message",
    name: "qq_forward_message",
    ownerOnly: true,
    description:
      "Forward a message by message_id to another QQ group or user. " +
      "target format: 'group:<group_id>' or 'private:<user_id>'.",
    parameters: objectSchema(
      {
        message_id: numberProp("Message ID to forward"),
        target: stringProp("Target in format 'group:<group_id>' or 'private:<user_id>'"),
      },
      ["message_id", "target"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { message_id, target } = args as { message_id: number; target: string };

      const isGroup = target.startsWith("group:");
      const id = Number(target.replace(/^(private|group):/, ""));
      if (Number.isNaN(id)) {
        return { content: [{ type: "text" as const, text: `Invalid target: ${target}` }] };
      }

      // Forward uses the forward segment wrapped in send_msg
      const forwardSegment = { type: "forward", data: { id: String(message_id) } };
      if (isGroup) {
        await sendGroupMsg(httpApi, id, [forwardSegment], accessToken);
      } else {
        await sendPrivateMsg(httpApi, id, [forwardSegment], accessToken);
      }

      return {
        content: [{ type: "text" as const, text: `Message ${message_id} forwarded to ${target}.` }],
      };
    },
  };
}

/** Set group member special title. */
export function createQQSetGroupSpecialTitleTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Special Title",
    name: "qq_set_group_special_title",
    ownerOnly: true,
    description:
      "Set a member's special title (exclusive tag) in a QQ group. Only the group owner can set this. " +
      "The user_id can come from an @QQNumber mention in the conversation.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        user_id: numberProp("Target QQ number"),
        special_title: stringProp("Special title text (empty string to clear)"),
      },
      ["group_id", "user_id", "special_title"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, user_id, special_title } = args as {
        group_id: number;
        user_id: number;
        special_title: string;
      };
      await callOneBotApi(
        httpApi,
        "set_group_special_title",
        { group_id, user_id, special_title, duration: -1 },
        { accessToken },
      );
      return {
        content: [
          {
            type: "text" as const,
            text: special_title
              ? `Set user ${user_id}'s special title to "${special_title}" in group ${group_id}.`
              : `Cleared user ${user_id}'s special title in group ${group_id}.`,
          },
        ],
      };
    },
  };
}

/** Leave (quit) a QQ group. */
export function createQQSetGroupLeaveTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Leave Group",
    name: "qq_leave_group",
    ownerOnly: true,
    description: "Make the bot leave (quit) a QQ group. If bot is owner, dissolve must be true.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number to leave"),
        is_dismiss: booleanProp("true = dissolve the group (owner only), false = just leave"),
      },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, is_dismiss = false } = args as { group_id: number; is_dismiss?: boolean };
      await callOneBotApi(
        httpApi,
        "set_group_leave",
        { group_id, is_dismiss },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `Left group ${group_id}${is_dismiss ? " (dissolved)" : ""}.` }],
      };
    },
  };
}

/** Handle a friend add request. */
export function createQQHandleFriendRequestTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Handle Friend Request",
    name: "qq_handle_friend_request",
    ownerOnly: true,
    description: "Approve or reject a friend add request. Requires the request flag from the event.",
    parameters: objectSchema(
      {
        flag: stringProp("Request flag identifier"),
        approve: booleanProp("true = approve, false = reject"),
        remark: stringProp("Remark name for the friend (optional, only when approving)"),
      },
      ["flag", "approve"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { flag, approve, remark } = args as { flag: string; approve: boolean; remark?: string };
      await callOneBotApi(
        httpApi,
        "set_friend_add_request",
        { flag, approve, remark: remark ?? "" },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `Friend request ${approve ? "approved" : "rejected"}.` }],
      };
    },
  };
}

/** Handle a group join/invite request. */
export function createQQHandleGroupRequestTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Handle Group Request",
    name: "qq_handle_group_request",
    ownerOnly: true,
    description:
      "Approve or reject a group join/invite request. Requires the request flag and sub_type from the event.",
    parameters: objectSchema(
      {
        flag: stringProp("Request flag identifier"),
        sub_type: stringProp("Request sub type: 'add' or 'invite'"),
        approve: booleanProp("true = approve, false = reject"),
        reason: stringProp("Rejection reason (optional, only when rejecting)"),
      },
      ["flag", "sub_type", "approve"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { flag, sub_type, approve, reason } = args as {
        flag: string;
        sub_type: string;
        approve: boolean;
        reason?: string;
      };
      await callOneBotApi(
        httpApi,
        "set_group_add_request",
        { flag, sub_type, approve, reason: reason ?? "" },
        { accessToken },
      );
      return {
        content: [{ type: "text" as const, text: `Group ${sub_type} request ${approve ? "approved" : "rejected"}.` }],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Message history & context tools
// ---------------------------------------------------------------------------

/** Get group message history. */
export function createQQGetGroupMsgHistoryTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Msg History",
    name: "qq_get_group_msg_history",
    ownerOnly: false,
    description: "Get recent message history from a QQ group. Returns the last N messages.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        count: optionalNumberProp("Number of messages to retrieve (default 20, max 100)"),
      },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, count = 20 } = args as { group_id: number; count?: number };
      const resp = await callOneBotApi<{ messages: Array<Record<string, unknown>> }>(
        httpApi, "get_group_msg_history", { group_id, count }, { accessToken },
      );
      const msgs = resp.data.messages ?? [];
      const lines = msgs.map((m) => {
        const sender = m.sender as Record<string, unknown> | undefined;
        const name = sender?.card || sender?.nickname || sender?.user_id || "unknown";
        const raw = m.raw_message ?? "";
        return `[${m.message_id}] ${name}: ${String(raw).slice(0, 200)}`;
      });
      return { content: [{ type: "text" as const, text: `Group ${group_id} history (${msgs.length}):\n${lines.join("\n")}` }] };
    },
  };
}

/** Get private/friend message history. */
export function createQQGetFriendMsgHistoryTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Friend Msg History",
    name: "qq_get_friend_msg_history",
    ownerOnly: false,
    description: "Get recent message history from a private/friend chat.",
    parameters: objectSchema(
      {
        user_id: numberProp("Friend QQ number"),
        count: optionalNumberProp("Number of messages to retrieve (default 20, max 100)"),
      },
      ["user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id, count = 20 } = args as { user_id: number; count?: number };
      const resp = await callOneBotApi<{ messages: Array<Record<string, unknown>> }>(
        httpApi, "get_friend_msg_history", { user_id, count }, { accessToken },
      );
      const msgs = resp.data.messages ?? [];
      const lines = msgs.map((m) => {
        const sender = m.sender as Record<string, unknown> | undefined;
        const name = sender?.nickname || sender?.user_id || "unknown";
        const raw = m.raw_message ?? "";
        return `[${m.message_id}] ${name}: ${String(raw).slice(0, 200)}`;
      });
      return { content: [{ type: "text" as const, text: `Friend ${user_id} history (${msgs.length}):\n${lines.join("\n")}` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Essence (pinned) message tools
// ---------------------------------------------------------------------------

/** Get group essence/pinned messages. */
export function createQQGetEssenceMsgListTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Essence Messages",
    name: "qq_get_essence_msg_list",
    ownerOnly: false,
    description: "Get the list of pinned/essence messages in a QQ group.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Array<Record<string, unknown>>>(
        httpApi, "get_essence_msg_list", { group_id }, { accessToken },
      );
      const list = resp.data ?? [];
      const lines = list.map((e) => {
        const name = e.sender_nick ?? e.sender_id ?? "unknown";
        return `[${e.message_id}] ${name}: ${String(e.content ?? e.message_seq ?? "").slice(0, 150)}`;
      });
      return { content: [{ type: "text" as const, text: `Group ${group_id} essence messages (${list.length}):\n${lines.join("\n")}` }] };
    },
  };
}

/** Pin a message as essence. */
export function createQQSetEssenceMsgTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Essence Message",
    name: "qq_set_essence_msg",
    ownerOnly: true,
    description: "Pin a message as an essence/pinned message in a QQ group.",
    parameters: objectSchema(
      { message_id: numberProp("Message ID to pin") },
      ["message_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { message_id } = args as { message_id: number };
      await callOneBotApi(httpApi, "set_essence_msg", { message_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Message ${message_id} pinned as essence.` }] };
    },
  };
}

/** Remove a pinned essence message. */
export function createQQDeleteEssenceMsgTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Delete Essence Message",
    name: "qq_delete_essence_msg",
    ownerOnly: true,
    description: "Remove a message from the essence/pinned list.",
    parameters: objectSchema(
      { message_id: numberProp("Message ID to unpin") },
      ["message_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { message_id } = args as { message_id: number };
      await callOneBotApi(httpApi, "delete_essence_msg", { message_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Message ${message_id} removed from essence.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Message emoji reaction
// ---------------------------------------------------------------------------

/** React to a message with an emoji. */
export function createQQSetMsgEmojiLikeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Message Emoji Reaction",
    name: "qq_set_msg_emoji_like",
    ownerOnly: false,
    description:
      "Add an emoji reaction to a message. Common emoji_id values: 128077(thumbs up), 128078(thumbs down), " +
      "128079(clap), 128512(laugh), 128525(heart eyes), 128557(cry), 128293(fire).",
    parameters: objectSchema(
      {
        message_id: numberProp("Message ID to react to"),
        emoji_id: numberProp("Emoji ID (unicode code point as number)"),
      },
      ["message_id", "emoji_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { message_id, emoji_id } = args as { message_id: number; emoji_id: number };
      await callOneBotApi(httpApi, "set_msg_emoji_like", { message_id, emoji_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Emoji reaction added to message ${message_id}.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

/** OCR image text recognition. */
export function createQQOcrImageTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ OCR Image",
    name: "qq_ocr_image",
    ownerOnly: false,
    description: "Perform OCR text recognition on an image. Provide the image file path or URL.",
    parameters: objectSchema(
      { image: stringProp("Image file path, URL, or file ID") },
      ["image"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { image } = args as { image: string };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "ocr_image", { image }, { accessToken },
      );
      const data = resp.data;
      const texts = (data.texts ?? data.text_detections ?? []) as Array<Record<string, unknown>>;
      const result = texts.map((t) => t.text ?? "").join("\n");
      return { content: [{ type: "text" as const, text: result || "No text detected." }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Friend management tools
// ---------------------------------------------------------------------------

/** Set friend remark/alias. */
export function createQQSetFriendRemarkTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Friend Remark",
    name: "qq_set_friend_remark",
    ownerOnly: true,
    description: "Set a remark/alias for a friend.",
    parameters: objectSchema(
      {
        user_id: numberProp("Friend QQ number"),
        remark: stringProp("New remark name"),
      },
      ["user_id", "remark"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id, remark } = args as { user_id: number; remark: string };
      await callOneBotApi(httpApi, "set_friend_remark", { user_id, remark }, { accessToken });
      return { content: [{ type: "text" as const, text: `Friend ${user_id} remark set to "${remark}".` }] };
    },
  };
}

/** Delete a friend. */
export function createQQDeleteFriendTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Delete Friend",
    name: "qq_delete_friend",
    ownerOnly: true,
    description: "Delete (remove) a friend from the bot's friend list. Use with caution.",
    parameters: objectSchema(
      { user_id: numberProp("Friend QQ number to delete") },
      ["user_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id } = args as { user_id: number };
      await callOneBotApi(httpApi, "delete_friend", { user_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Friend ${user_id} has been deleted.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Group file management tools
// ---------------------------------------------------------------------------

/** Get group root files list. */
export function createQQGetGroupRootFilesTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Files",
    name: "qq_get_group_root_files",
    ownerOnly: false,
    description: "Get the list of files and folders in a QQ group's root file directory.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "get_group_root_files", { group_id }, { accessToken },
      );
      const files = (resp.data.files ?? []) as Array<Record<string, unknown>>;
      const folders = (resp.data.folders ?? []) as Array<Record<string, unknown>>;
      const folderLines = folders.map((f) => `[Folder] ${f.folder_name} (id: ${f.folder_id})`);
      const fileLines = files.map((f) => `[File] ${f.file_name} (id: ${f.file_id}, size: ${f.file_size ?? "?"})`);
      return { content: [{ type: "text" as const, text: `Group ${group_id} files:\n${[...folderLines, ...fileLines].join("\n") || "Empty"}` }] };
    },
  };
}

/** Get group file download URL. */
export function createQQGetGroupFileUrlTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group File URL",
    name: "qq_get_group_file_url",
    ownerOnly: false,
    description: "Get the download URL for a file in a QQ group. Requires file_id and busid from the file list.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        file_id: stringProp("File ID"),
        busid: numberProp("Business ID of the file"),
      },
      ["group_id", "file_id", "busid"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, file_id, busid } = args as { group_id: number; file_id: string; busid: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "get_group_file_url", { group_id, file_id, busid }, { accessToken },
      );
      const url = resp.data.url ?? "unknown";
      return { content: [{ type: "text" as const, text: `Download URL: ${url}` }] };
    },
  };
}

/** Create a folder in group file system. */
export function createQQCreateGroupFileFolderTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Create Group File Folder",
    name: "qq_create_group_file_folder",
    ownerOnly: true,
    description: "Create a new folder in a QQ group's file system.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        name: stringProp("Folder name"),
      },
      ["group_id", "name"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, name } = args as { group_id: number; name: string };
      await callOneBotApi(httpApi, "create_group_file_folder", { group_id, name }, { accessToken });
      return { content: [{ type: "text" as const, text: `Folder "${name}" created in group ${group_id}.` }] };
    },
  };
}

/** Delete a file from group file system. */
export function createQQDeleteGroupFileTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Delete Group File",
    name: "qq_delete_group_file",
    ownerOnly: true,
    description: "Delete a file from a QQ group's file system.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        file_id: stringProp("File ID to delete"),
        busid: numberProp("Business ID of the file"),
      },
      ["group_id", "file_id", "busid"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, file_id, busid } = args as { group_id: number; file_id: string; busid: number };
      await callOneBotApi(httpApi, "delete_group_file", { group_id, file_id, busid }, { accessToken });
      return { content: [{ type: "text" as const, text: `File deleted from group ${group_id}.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Group notice (announcement) management
// ---------------------------------------------------------------------------

/** Get group announcements/notices. */
export function createQQGetGroupNoticeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get Group Notices",
    name: "qq_get_group_notice",
    ownerOnly: false,
    description: "Get the list of announcements/notices in a QQ group.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Array<Record<string, unknown>>>(
        httpApi, "_get_group_notice", { group_id }, { accessToken },
      );
      const notices = resp.data ?? [];
      const lines = notices.map((n) => {
        const msg = n.message as Record<string, unknown> | undefined;
        const text = msg?.text ?? n.content ?? "";
        return `[${n.notice_id}] ${String(text).slice(0, 200)}`;
      });
      return { content: [{ type: "text" as const, text: `Group ${group_id} notices (${notices.length}):\n${lines.join("\n")}` }] };
    },
  };
}

/** Delete a group announcement/notice. */
export function createQQDeleteGroupNoticeTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Delete Group Notice",
    name: "qq_delete_group_notice",
    ownerOnly: true,
    description: "Delete a specific announcement/notice from a QQ group.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        notice_id: stringProp("Notice ID to delete"),
      },
      ["group_id", "notice_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, notice_id } = args as { group_id: number; notice_id: string };
      await callOneBotApi(httpApi, "_del_group_notice", { group_id, notice_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Notice ${notice_id} deleted from group ${group_id}.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Group portrait
// ---------------------------------------------------------------------------

/** Set group avatar/portrait. */
export function createQQSetGroupPortraitTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Portrait",
    name: "qq_set_group_portrait",
    ownerOnly: true,
    description: "Set the group avatar/portrait. Provide an image file path or URL.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        file: stringProp("Image file path or URL"),
      },
      ["group_id", "file"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, file } = args as { group_id: number; file: string };
      await callOneBotApi(httpApi, "set_group_portrait", { group_id, file }, { accessToken });
      return { content: [{ type: "text" as const, text: `Group ${group_id} portrait updated.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Forward (merge) message tools
// ---------------------------------------------------------------------------

/** Send a merged forward message to a group. */
export function createQQSendGroupForwardMsgTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Send Group Forward Msg",
    name: "qq_send_group_forward_msg",
    ownerOnly: true,
    description:
      "Send a merged forward message (multiple messages combined) to a group. " +
      "Provide an array of node objects. Each node: {type:'node', data:{name:'sender', uin:'QQ', content:[{type:'text',data:{text:'...'}}]}}.",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        messages: { type: "array" as const, items: { type: "object" as const }, description: "Array of forward message node objects" },
      },
      ["group_id", "messages"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, messages } = args as { group_id: number; messages: unknown[] };
      await callOneBotApi(httpApi, "send_group_forward_msg", { group_id, messages }, { accessToken });
      return { content: [{ type: "text" as const, text: `Merged forward message sent to group ${group_id}.` }] };
    },
  };
}

/** Send a merged forward message to a private chat. */
export function createQQSendPrivateForwardMsgTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Send Private Forward Msg",
    name: "qq_send_private_forward_msg",
    ownerOnly: true,
    description:
      "Send a merged forward message (multiple messages combined) to a private chat. " +
      "Provide an array of node objects.",
    parameters: objectSchema(
      {
        user_id: numberProp("Target QQ number"),
        messages: { type: "array" as const, items: { type: "object" as const }, description: "Array of forward message node objects" },
      },
      ["user_id", "messages"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { user_id, messages } = args as { user_id: number; messages: unknown[] };
      await callOneBotApi(httpApi, "send_private_forward_msg", { user_id, messages }, { accessToken });
      return { content: [{ type: "text" as const, text: `Merged forward message sent to user ${user_id}.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Mark as read
// ---------------------------------------------------------------------------

/** Mark messages as read. */
export function createQQMarkMsgAsReadTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Mark Msg As Read",
    name: "qq_mark_msg_as_read",
    ownerOnly: false,
    description: "Mark messages as read in a group or private chat. target format: 'group:<group_id>' or 'private:<user_id>'.",
    parameters: objectSchema(
      { target: stringProp("Target: 'group:<group_id>' or 'private:<user_id>'") },
      ["target"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { target } = args as { target: string };
      const isGroup = target.startsWith("group:");
      const id = Number(target.replace(/^(private|group):/, ""));
      if (Number.isNaN(id)) {
        return { content: [{ type: "text" as const, text: `Invalid target: ${target}` }] };
      }
      if (isGroup) {
        await callOneBotApi(httpApi, "mark_group_msg_as_read", { group_id: id }, { accessToken });
      } else {
        await callOneBotApi(httpApi, "mark_private_msg_as_read", { user_id: id }, { accessToken });
      }
      return { content: [{ type: "text" as const, text: `Messages marked as read for ${target}.` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Misc utility tools
// ---------------------------------------------------------------------------

/** Get @all remain count in a group. */
export function createQQGetGroupAtAllRemainTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Get @All Remain",
    name: "qq_get_group_at_all_remain",
    ownerOnly: false,
    description: "Get the remaining number of times @all can be used today in a group.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "get_group_at_all_remain", { group_id }, { accessToken },
      );
      const d = resp.data;
      return {
        content: [{
          type: "text" as const,
          text: `Group ${group_id} @all remain: can_at_all=${d.can_at_all}, remain_at_all_count_for_group=${d.remain_at_all_count_for_group}, remain_at_all_count_for_uin=${d.remain_at_all_count_for_uin}`,
        }],
      };
    },
  };
}

/** Translate English to Chinese. */
export function createQQTranslateTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Translate EN→ZH",
    name: "qq_translate_en2zh",
    ownerOnly: false,
    description: "Translate English text to Chinese using QQ's built-in translation service.",
    parameters: objectSchema(
      { text: stringProp("English text to translate") },
      ["text"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { text } = args as { text: string };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "translate_en2zh", { text }, { accessToken },
      );
      return { content: [{ type: "text" as const, text: String(resp.data.result ?? resp.data.text ?? JSON.stringify(resp.data)) }] };
    },
  };
}

/** Download a file from URL. */
export function createQQDownloadFileTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Download File",
    name: "qq_download_file",
    ownerOnly: true,
    description: "Download a file from a URL to the bot's local storage. Returns the local file path.",
    parameters: objectSchema(
      {
        url: stringProp("URL of the file to download"),
        thread_count: optionalNumberProp("Number of download threads (default 1)"),
      },
      ["url"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { url, thread_count = 1 } = args as { url: string; thread_count?: number };
      const resp = await callOneBotApi<Record<string, unknown>>(
        httpApi, "download_file", { url, thread_count, headers: [] }, { accessToken, timeoutMs: 60_000 },
      );
      const file = resp.data.file ?? "unknown";
      return { content: [{ type: "text" as const, text: `File downloaded to: ${file}` }] };
    },
  };
}

/** Group sign-in (check-in). */
export function createQQSetGroupSignTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Group Sign In",
    name: "qq_set_group_sign",
    ownerOnly: false,
    description: "Perform a daily sign-in/check-in for the bot in a QQ group.",
    parameters: objectSchema(
      { group_id: numberProp("Group number") },
      ["group_id"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id } = args as { group_id: number };
      await callOneBotApi(httpApi, "send_group_sign", { group_id }, { accessToken });
      return { content: [{ type: "text" as const, text: `Signed in for group ${group_id}.` }] };
    },
  };
}

/** Set group remark (bot-side note for the group). */
export function createQQSetGroupRemarkTool(cfg: OpenClawConfig): ChannelAgentTool {
  return {
    label: "QQ Set Group Remark",
    name: "qq_set_group_remark",
    ownerOnly: true,
    description: "Set a remark/note for a group (only visible to the bot).",
    parameters: objectSchema(
      {
        group_id: numberProp("Group number"),
        remark: stringProp("New remark text"),
      },
      ["group_id", "remark"],
    ),
    execute: async (_toolCallId, args) => {
      const { httpApi, accessToken } = resolveHttpApi(cfg);
      const { group_id, remark } = args as { group_id: number; remark: string };
      await callOneBotApi(httpApi, "set_group_remark", { group_id, remark }, { accessToken });
      return { content: [{ type: "text" as const, text: `Group ${group_id} remark set to "${remark}".` }] };
    },
  };
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/** Build all NapCat agent tools. */
/** Build all NapCat agent tools. */
export function createNapCatAgentTools(cfg: OpenClawConfig): ChannelAgentTool[] {
  const rawTools: ChannelAgentTool[] = [
    // Query tools
    createQQLikeTool(cfg),
    createQQGetUserInfoTool(cfg),
    createQQGetGroupInfoTool(cfg),
    createQQGetGroupMemberInfoTool(cfg),
    createQQGetFriendListTool(cfg),
    createQQGetGroupListTool(cfg),
    createQQGetGroupMemberListTool(cfg),
    createQQGetGroupHonorInfoTool(cfg),
    // Message history & context
    createQQGetGroupMsgHistoryTool(cfg),
    createQQGetFriendMsgHistoryTool(cfg),
    createQQGetEssenceMsgListTool(cfg),
    // Interaction tools
    createQQPokeTool(cfg),
    createQQRecallMessageTool(cfg),
    createQQSetMsgEmojiLikeTool(cfg),
    createQQOcrImageTool(cfg),
    createQQTranslateTool(cfg),
    createQQMarkMsgAsReadTool(cfg),
    // Messaging tools (text, image, voice, video, file, forward)
    createQQSendMessageTool(cfg),
    createQQUploadFileTool(cfg),
    createQQForwardMessageTool(cfg),
    createQQSendGroupForwardMsgTool(cfg),
    createQQSendPrivateForwardMsgTool(cfg),
    createQQDownloadFileTool(cfg),
    // Essence message management
    createQQSetEssenceMsgTool(cfg),
    createQQDeleteEssenceMsgTool(cfg),
    // Friend management
    createQQSetFriendRemarkTool(cfg),
    createQQDeleteFriendTool(cfg),
    // Group management tools
    createQQMuteGroupMemberTool(cfg),
    createQQKickGroupMemberTool(cfg),
    createQQSetGroupCardTool(cfg),
    createQQSetGroupAdminTool(cfg),
    createQQSetGroupNameTool(cfg),
    createQQSetGroupWholeBanTool(cfg),
    createQQSetGroupSpecialTitleTool(cfg),
    createQQSetGroupLeaveTool(cfg),
    createQQSetGroupPortraitTool(cfg),
    createQQSetGroupSignTool(cfg),
    createQQSetGroupRemarkTool(cfg),
    createQQGetGroupAtAllRemainTool(cfg),
    // Group notice management
    createQQSendGroupNoticeTool(cfg),
    createQQGetGroupNoticeTool(cfg),
    createQQDeleteGroupNoticeTool(cfg),
    // Group file management
    createQQGetGroupRootFilesTool(cfg),
    createQQGetGroupFileUrlTool(cfg),
    createQQCreateGroupFileFolderTool(cfg),
    createQQDeleteGroupFileTool(cfg),
    // Request handling tools
    createQQHandleFriendRequestTool(cfg),
    createQQHandleGroupRequestTool(cfg),
  ];

  // 核心修复：统一拦截 execute，自动补齐新版 SDK 必需的 details 字段
  return rawTools.map((tool) => {
    const originalExecute = tool.execute;
    if (!originalExecute) return tool;

    return {
      ...tool,
      execute: (async (toolCallId: string, params: unknown, signal?: AbortSignal, onUpdate?: any) => {
        const result = await originalExecute(toolCallId, params, signal, onUpdate);
        return {
          ...result,
          details: (result as any).details ?? {}, // 如果没有 details，就塞一个空对象
        };
      }) as any, // 使用 as any 绕过新旧版本的返回值类型推导差异
    };
  });
}