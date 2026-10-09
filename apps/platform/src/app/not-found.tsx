import Link from 'next/link';
import { Button, Result } from 'antd';

export default function NotFound() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在"
      extra={
        <Link href="/">
          <Button type="primary">返回市场</Button>
        </Link>
      }
    />
  );
}
