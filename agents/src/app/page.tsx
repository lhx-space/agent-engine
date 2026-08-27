export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1>Agent Engine · Next.js Host</h1>
      <p>
        一个 agent = <code>.lhx-agent/&lt;name&gt;/</code> 目录（文件形式）。运行时扫描目录 →
        构建协议 → 调内核运行。
      </p>
      <h2>用法</h2>
      <pre>{`POST /api/agent/:name/run
Content-Type: application/json

{ "input": "你的问题" }`}</pre>
    </main>
  );
}
