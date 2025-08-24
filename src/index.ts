import { isEqual } from "lodash";
import { parseCurl, ParsedCurl, ParsedKey } from "./parseCurl"; // 假设 parseCurl 已经是我们前面完善的版本

export type CompareResult = Record<
  ParsedKey,
  null | {
    same: boolean;
    value?: any;
    values?: any[];
  }
>;

export function compareCurls(curlList: string[]): CompareResult {
  if (!curlList || curlList.length === 0) {
    return {
      method: null,
      url: null,
      query: null,
      header: null,
      body: null,
    };
  }

  const parsedList: ParsedCurl[] = curlList
    .map((curl) => parseCurl(curl))
    .filter(Boolean) as ParsedCurl[];

  const keys: ParsedKey[] = [
    "method",
    "url",
    "query",
    "header",
    "body",
  ];

  const result: CompareResult = {
    method: null,
    url: null,
    query: null,
    header: null,
    body: null,
  };

  keys.forEach((key) => {
    const values = parsedList.map((p) => p[key]);

    // 对 query 和 header 做深度排序处理，忽略顺序
    const normalizedValues = values.map((v) => {
      if (v && typeof v === "object") {
        return sortObjectDeep(v);
      }
      return v;
    });

    const allSame = normalizedValues.every((v) =>
      isEqual(v, normalizedValues[0])
    );

    result[key] = allSame
      ? { same: true, value: values[0] }
      : { same: false, values };
  });

  return result;
}

/** 深度排序对象的键，用于忽略 JSON 或 form-urlencoded 内部顺序 */
function sortObjectDeep(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectDeep);
  }
  if (obj && typeof obj === "object") {
    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach((k) => {
        sorted[k] = sortObjectDeep(obj[k]);
      });
    return sorted;
  }
  return obj;
}
