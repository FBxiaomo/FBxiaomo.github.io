export interface Friend {
  name: string;
  desc: string;
  href: string;
}

/** 添加真实友链后会自动显示在友链页。 */
export const friends: Friend[] = [];
