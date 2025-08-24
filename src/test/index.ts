import { parseCurl, ParsedCurl } from '../parseCurl';
import { curlDiff, CompareResult } from '../index';

describe('parseCurl', () => {

  test('解析简单 GET 请求', () => {
    const curl = `curl "https://example.com/api?a=1&b=2"`;
    const result = parseCurl(curl);
    expect(result).not.toBeNull();
    expect(result?.method).toBe('GET');
    expect(result?.url).toBe('https://example.com/api');
    expect(result?.query).toEqual({ a: '1', b: '2' });
  });

  test('解析 POST JSON 请求', () => {
    const curl = `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"Alice","age":25}'`;
    const result = parseCurl(curl);
    expect(result?.method).toBe('POST');
    expect(result?.body).toEqual({ name: 'Alice', age: 25 });
  });

  test('解析 x-www-form-urlencoded 请求', () => {
    const curl = `curl -d "x=1&y=2" "https://example.com/api"`;
    const result = parseCurl(curl);
    expect(result?.body).toEqual({ x: '1', y: '2' });
    expect(result?.method).toBe('POST'); // 自动从 GET 变 POST
  });

  test('解析 header 与 Authorization', () => {
    const curl = `curl -H "X-Test: 123" -u "user:pass" "https://example.com/api"`;
    const result = parseCurl(curl);
    expect(result?.header['X-Test']).toBe('123');
    expect(result?.header['Authorization']).toBe('Basic ' + Buffer.from('user:pass').toString('base64'));
  });

});

describe('curlDiff', () => {

  test('比较相同 curl，返回 same=true', () => {
  const curl1 = `curl -X POST "https://example.com/api?a=1&b=2" -H "Content-Type: application/json" -d '{"name":"Alice","age":25}'`;
  const curl2 = `curl -X POST "https://example.com/api?b=2&a=1" -H "Content-Type: application/json" -d '{"age":25,"name":"Alice"}'`;
  const result1 = parseCurl(curl1);
  const result2 = parseCurl(curl2);
  const result = curlDiff([curl1, curl2]);

  expect(result?.method.same).toBe(true);
  expect(result?.url.same).toBe(true);
  expect(result?.query.same).toBe(true);
  expect(result?.header.same).toBe(true);
  expect(result?.body.same).toBe(true);
  });

  test('比较不同 curl，返回 same=false', () => {
  const curl1 = `curl -X POST "https://example.com/api" -d "x=1&y=2"`;
  const curl2 = `curl -X POST "https://example.com/api" -d "x=3&y=4"`;
  const result1 = parseCurl(curl1);
  const result2 = parseCurl(curl2);
  const result = curlDiff([curl1, curl2]);

  expect(result?.body.same).toBe(false);
  expect(result?.body.values).toEqual([{ x: '1', y: '2' }, { x: '3', y: '4' }]);
  });

  test('比较 header 顺序不同仍然 same=true', () => {
  const curl1 = `curl -H "A: 1" -H "B: 2" "https://example.com/api"`;
  const curl2 = `curl -H "B: 2" -H "A: 1" "https://example.com/api"`;
  const result1 = parseCurl(curl1);
  const result2 = parseCurl(curl2);
  const result = curlDiff([curl1, curl2]);

  expect(result?.header.same).toBe(true);
  expect(result?.header.value).toEqual({ A: '1', B: '2' });
  });

});
