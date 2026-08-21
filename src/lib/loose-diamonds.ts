export function looseDiamondImagePath(diamond: {
  image_path: string | null;
  carat_weight: number | null;
  page: number | null;
}) {
  if (diamond.image_path?.startsWith("2_carat_images/")) return diamond.image_path;
  if (diamond.image_path?.startsWith("3_carat_images/")) return diamond.image_path;
  if (diamond.image_path?.startsWith("4_carat_images/")) return diamond.image_path;

  const carat = Number(diamond.carat_weight ?? 0);
  if (carat >= 4 && diamond.page != null) {
    return `4_carat_images/page_${String(diamond.page).padStart(3, "0")}.png`;
  }

  return diamond.image_path;
}
