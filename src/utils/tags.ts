export interface TagOption {
  label: string;
  value: string;
  [key: string]: unknown;
}

export function normalizeTag(tag: string): string {
  // 标签以去除首尾空白后的文本作为业务值；空白内容不构成有效标签。
  return tag.trim();
}

export function normalizeTagList(tags: string[]): string[] {
  const normalized = new Set<string>();
  for (const tag of tags) {
    // 同一池或同一字段内禁止重复标签，因此保存前统一 trim 并通过 Set 去重。
    const value = normalizeTag(tag);
    if (value) normalized.add(value);
  }
  return Array.from(normalized).sort((a, b) => a.localeCompare(b));
}

export function buildTagOptions(pool: string[]): TagOption[] {
  // 可新建标签的 NSelect 会为输入值生成临时选项；这里仅返回已入池标签，避免临时值和池内值重复显示。
  return normalizeTagList(pool).map(tag => ({ label: tag, value: tag }));
}

export function buildTagOptionsWithCurrent(pool: string[], current: string[] = []): TagOption[] {
  // 非 tag 模式没有临时选项机制，因此需要把当前已选值并入选项，保证旧数据或未入池值仍可显示。
  return normalizeTagList([...pool, ...current]).map(tag => ({ label: tag, value: tag }));
}
