import { networkInterfaces } from "node:os";

import { lanListenAddresses } from "../src/lib/pwa/dev-origins";

const port = process.env.PORT ?? "3000";
const addresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((item) => (item?.address ? [item.address] : []));
const urls = lanListenAddresses(addresses).map((address) => `https://${address}:${port}`);

if (urls.length === 0) {
  process.stdout.write("같은 와이파이에서 쓸 PC 주소가 없습니다. PC와 휴대폰을 같은 네트워크에 연결해 주세요.\n");
  process.exit(0);
}

process.stdout.write("휴대폰 브라우저에서 아래 주소로 여세요. 인증서 경고가 나오면 고급에서 계속을 누릅니다.\n");
for (const url of urls) process.stdout.write(`${url}\n`);
