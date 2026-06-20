// Bundled code snippets for the Code typing mode. Same static-content rule as
// the word lists and quotes: no AI, no external API. Every snippet is
// space-indented (never tabs) so the Tab restart hotkey never collides with
// typing, and the typing engine treats indentation as ordinary characters.

import type { CodeLanguage } from './preferences'

export interface CodeSnippet {
  text: string
}

export const CODE_SNIPPETS: Record<CodeLanguage, readonly CodeSnippet[]> = {
  python: [
    { text: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)' },
    { text: 'def fizzbuzz(n):\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            print("FizzBuzz")\n        elif i % 3 == 0:\n            print("Fizz")\n        else:\n            print(i)' },
    { text: 'squares = [x * x for x in range(10) if x % 2 == 0]\ntotal = sum(squares)\nprint(f"total = {total}")' },
    { text: 'class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, value):\n        self.items.append(value)\n\n    def pop(self):\n        return self.items.pop()' },
    { text: 'def read_config(path):\n    with open(path) as f:\n        data = json.load(f)\n    return {k: v for k, v in data.items() if v is not None}' },
    { text: 'def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        if arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1' },
    { text: 'async def fetch_all(urls):\n    async with aiohttp.ClientSession() as session:\n        tasks = [session.get(url) for url in urls]\n        return await asyncio.gather(*tasks)' },
    { text: 'def group_by(items, key):\n    result = {}\n    for item in items:\n        result.setdefault(key(item), []).append(item)\n    return result' },
    { text: '@dataclass\nclass Point:\n    x: float = 0.0\n    y: float = 0.0\n\n    def distance(self, other):\n        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5' },
    { text: 'def parse_args():\n    parser = argparse.ArgumentParser()\n    parser.add_argument("--verbose", action="store_true")\n    parser.add_argument("--count", type=int, default=1)\n    return parser.parse_args()' },
    { text: 'try:\n    value = int(raw_input)\nexcept ValueError:\n    value = 0\nfinally:\n    print(f"parsed {value}")' },
    { text: 'def memoize(func):\n    cache = {}\n    def wrapper(*args):\n        if args not in cache:\n            cache[args] = func(*args)\n        return cache[args]\n    return wrapper' },
  ],
  javascript: [
    { text: 'function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}' },
    { text: 'const nums = [1, 2, 3, 4, 5];\nconst total = nums\n  .map((n) => n * 2)\n  .filter((n) => n > 4)\n  .reduce((a, b) => a + b, 0);' },
    { text: 'async function fetchUser(id) {\n  const res = await fetch(`/api/users/${id}`);\n  if (!res.ok) throw new Error("not found");\n  return res.json();\n}' },
    { text: 'class Queue {\n  constructor() {\n    this.items = [];\n  }\n\n  enqueue(value) {\n    this.items.push(value);\n  }\n\n  dequeue() {\n    return this.items.shift();\n  }\n}' },
    { text: 'const debounce = (fn, ms) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n};' },
    { text: 'function groupBy(items, key) {\n  return items.reduce((acc, item) => {\n    const k = key(item);\n    (acc[k] ||= []).push(item);\n    return acc;\n  }, {});\n}' },
    { text: 'const config = {\n  retries: 3,\n  timeout: 5000,\n  headers: { "Content-Type": "application/json" },\n};' },
    { text: 'for (let i = 0; i < items.length; i++) {\n  const item = items[i];\n  if (!item.active) continue;\n  console.log(`${i}: ${item.name}`);\n}' },
    { text: 'export function clamp(value, min, max) {\n  return Math.max(min, Math.min(max, value));\n}' },
    { text: 'const handler = {\n  get(target, prop) {\n    return prop in target ? target[prop] : null;\n  },\n};\nconst proxy = new Proxy({}, handler);' },
    { text: 'try {\n  const data = JSON.parse(raw);\n  process(data);\n} catch (err) {\n  console.error("parse failed:", err.message);\n}' },
    { text: 'const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);\nconst result = pipe(double, increment, square)(3);' },
  ],
  c: [
    { text: 'int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}' },
    { text: 'int sum_array(const int *arr, size_t len) {\n    int total = 0;\n    for (size_t i = 0; i < len; i++) {\n        total += arr[i];\n    }\n    return total;\n}' },
    { text: 'struct Node {\n    int value;\n    struct Node *next;\n};\n\nstruct Node *head = NULL;' },
    { text: 'int binary_search(const int *arr, int n, int target) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}' },
    { text: 'char *duplicate(const char *src) {\n    size_t len = strlen(src) + 1;\n    char *dst = malloc(len);\n    if (dst != NULL) {\n        memcpy(dst, src, len);\n    }\n    return dst;\n}' },
    { text: 'void swap(int *a, int *b) {\n    int tmp = *a;\n    *a = *b;\n    *b = tmp;\n}' },
    { text: 'int main(int argc, char **argv) {\n    if (argc < 2) {\n        fprintf(stderr, "usage: %s <name>\\n", argv[0]);\n        return 1;\n    }\n    printf("hello, %s\\n", argv[1]);\n    return 0;\n}' },
    { text: 'for (int i = 0; i < rows; i++) {\n    for (int j = 0; j < cols; j++) {\n        grid[i][j] = i * cols + j;\n    }\n}' },
    { text: 'typedef struct {\n    double x;\n    double y;\n} Point;\n\ndouble dot(Point a, Point b) {\n    return a.x * b.x + a.y * b.y;\n}' },
    { text: 'FILE *fp = fopen(path, "r");\nif (fp == NULL) {\n    perror("fopen");\n    return -1;\n}\nfclose(fp);' },
    { text: 'unsigned int gcd(unsigned int a, unsigned int b) {\n    while (b != 0) {\n        unsigned int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}' },
    { text: 'enum Color { RED, GREEN, BLUE };\n\nconst char *name(enum Color c) {\n    switch (c) {\n        case RED: return "red";\n        case GREEN: return "green";\n        default: return "blue";\n    }\n}' },
  ],
}

const wordCount = (s: string) => s.trim().split(/\s+/).length

/**
 * Build target text for the Code mode: for short targets a single snippet reads
 * better than a fragment; otherwise concatenate distinct random snippets (joined
 * by a blank line) until at least `targetWords` words are reached, allowing reuse
 * if the pool empties first. Mirrors buildQuoteTarget in lib/quotes.ts.
 */
export function buildCodeTarget(
  targetWords: number,
  lang: CodeLanguage,
  rng: () => number = Math.random,
): { text: string } {
  const snippets = CODE_SNIPPETS[lang]

  if (targetWords <= 25) {
    let best = snippets[0]!
    let bestDiff = Infinity
    for (const s of snippets) {
      const diff = Math.abs(wordCount(s.text) - targetWords)
      if (diff < bestDiff) {
        bestDiff = diff
        best = s
      }
    }
    return { text: best.text }
  }

  const parts: string[] = []
  let words = 0
  const pool = [...snippets]
  while (words < targetWords && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length)
    const s = pool.splice(idx, 1)[0]!
    parts.push(s.text)
    words += wordCount(s.text)
    if (pool.length === 0 && words < targetWords) pool.push(...snippets) // allow reuse to fill
  }
  return { text: parts.join('\n\n') }
}
