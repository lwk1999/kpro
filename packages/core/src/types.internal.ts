/** 内部类型：不对外导出。 */

/** 可替换的存储适配器。 */
export interface GuideStorageAdapter {
  /** 读取键值，不存在时返回 null。 */
  read: (key: string) => string | null;
  /** 写入键值。 */
  write: (key: string, value: string) => void;
}