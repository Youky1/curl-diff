import * as shellwords from "shellwords";
import * as qs from "querystring";
import fs from "fs";
import urlLib from "url";
import { Buffer } from "buffer";

export interface ParsedCurl {
  method: string;
  url?: string;
  query?: Record<string, string>;
  header: Record<string, string>;
  /** body 尝试解析为对象，如果无法解析则保持原始字符串或 Buffer */
  body?: any;
}

export type ParsedKey = 'method' | 'url' | 'query' | 'header' | 'body';
 

export function parseCurl(curl: string): ParsedCurl | null {
  if (!curl.startsWith("curl ")) return null;

  const args = shellwords.split(curl);
  const out: ParsedCurl = { method: "GET", header: {} };
  let state: string | null = null;

  args.forEach((arg) => {
    switch (true) {
      case isURL(arg):
        const parsedUrl = urlLib.parse(arg, true);
        out.url =
          parsedUrl.protocol && parsedUrl.host
            ? `${parsedUrl.protocol}//${parsedUrl.host}${
                parsedUrl.pathname || ""
              }`
            : arg;
        out.query = parsedUrl.query as Record<string, string>;
        break;
      case arg === "-X" || arg === "--request":
        state = "method";
        break;
      case arg === "-H" || arg === "--header":
        state = "header";
        break;
      case arg === "-d" ||
        arg === "--data" ||
        arg === "--data-raw" ||
        arg === "--data-ascii":
        state = "data";
        break;
      case arg === "-F" || arg === "--form":
        state = "form";
        break;
      case arg === "--data-binary":
        state = "binary";
        break;
      case arg === "--compressed":
        out.header["Accept-Encoding"] =
          out.header["Accept-Encoding"] || "deflate, gzip";
        break;
      case arg === "-u" || arg === "--user":
        state = "auth";
        break;
      default:
        switch (state) {
          case "method":
            out.method = arg.toUpperCase();
            break;
          case "header":
            {
              const [k, v] = parseHeader(arg);
              out.header[k] = v;
            }
            break;
          case "data":
            out.method = out.method === "GET" ? "POST" : out.method;
            out.body = parseBody(arg, out.header["Content-Type"]);
            break;
          case "form":
            out.method = out.method === "GET" ? "POST" : out.method;
            out.body = parseFormData(arg);
            break;
          case "binary":
            out.method = out.method === "GET" ? "POST" : out.method;
            out.body = arg; // 保持原始
            break;
          case "auth":
            out.header["Authorization"] =
              "Basic " + Buffer.from(arg).toString("base64");
            break;
        }
        state = null;
        break;
    }
  });

  return out;
}

/** 判断是否 URL */
function isURL(str: string) {
  return /^https?:\/\//i.test(str);
}

/** 解析 header: "Key: Value" */
function parseHeader(str: string): [string, string] {
  const idx = str.indexOf(":");
  if (idx === -1) return [str, ""];
  const key = str.slice(0, idx).trim();
  const value = str.slice(idx + 1).trim();
  return [key, value];
}

/** 解析普通 data body，根据 Content-Type 尝试转对象 */
function parseBody(str: string, contentType?: string): any {
  if (!contentType) contentType = "application/x-www-form-urlencoded";

  try {
    if (contentType.includes("application/json")) {
      return JSON.parse(str);
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      return qs.parse(str);
    }
  } catch (e) {
    // 解析失败就保持原值
  }

  return str;
}

/** 解析 form-data 参数: "key=value" 或 "key=@file" */
function parseFormData(str: string): Record<string, any> {
  const obj: Record<string, any> = {};
  const idx = str.indexOf("=");
  if (idx === -1) return obj;

  const key = str.slice(0, idx);
  let value: any = str.slice(idx + 1);

  if (value.startsWith("@")) {
    const filePath = value.slice(1);
    try {
      value = fs.readFileSync(filePath); // Buffer
    } catch {
      value = filePath; // 文件不存在，保持路径
    }
  }

  obj[key] = value;
  return obj;
}
