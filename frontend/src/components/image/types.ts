export interface ImagePresetItem {
  name: string;
  nameEn: string;
  width: number;
  height: number;
  desc: string;
  descEn: string;
}

export const PRESETS: readonly ImagePresetItem[] = [
  {
    name: "1寸证件照",
    nameEn: "1-inch ID Photo",
    width: 295,
    height: 413,
    desc: "标准1寸 (25x35mm, 300DPI)",
    descEn: "Standard 1-inch (25x35mm, 300DPI)",
  },
  {
    name: "2寸证件照",
    nameEn: "2-inch ID Photo",
    width: 413,
    height: 579,
    desc: "标准2寸 (35x49mm, 300DPI)",
    descEn: "Standard 2-inch (35x49mm, 300DPI)",
  },
  {
    name: "微信头像 / 正方形",
    nameEn: "Square Avatar",
    width: 500,
    height: 500,
    desc: "1:1 正方形头像",
    descEn: "1:1 Square Avatar",
  },
  {
    name: "小红书封面配图",
    nameEn: "Social Media Cover",
    width: 1242,
    height: 1656,
    desc: "3:4 竖屏高清规格",
    descEn: "3:4 Portrait HD",
  },
  {
    name: "公众号文章首图",
    nameEn: "Article Banner",
    width: 900,
    height: 383,
    desc: "2.35:1 横屏横幅",
    descEn: "2.35:1 Landscape Banner",
  },
  {
    name: "1080P 高清壁纸",
    nameEn: "1080P Wallpaper",
    width: 1920,
    height: 1080,
    desc: "16:9 全高清显示",
    descEn: "16:9 Full HD",
  },
] as const;
