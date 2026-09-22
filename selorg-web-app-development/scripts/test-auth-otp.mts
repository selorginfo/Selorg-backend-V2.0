/**
 * End-to-end auth API smoke test — run while selorg-service is on port 3333:
 *   npx tsx scripts/test-auth-otp.mts
 */
const API = process.env.API_BASE_URL ?? "http://localhost:3333/api/v1/customer";

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log("Testing send-otp (webapp contract)…");
  const send = await post("/auth/send-otp", {
    phoneNumber: "+919698790921",
    preferredChannel: "sms",
    intent: "login",
  });
  console.log("send-otp status:", send.status, "success:", send.json.success);
  if (!send.json.success) {
    console.error(send.json);
    process.exit(1);
  }
  const sessionId = send.json.data.sessionId as string;
  console.log("sessionId:", sessionId);

  console.log("Testing verify-otp with test OTP 8790…");
  const verify = await post("/auth/verify-otp", { sessionId, otp: "8790" });
  console.log("verify-otp status:", verify.status, "success:", verify.json.success);
  if (!verify.json.success) {
    console.error(verify.json);
    process.exit(1);
  }
  console.log("user:", verify.json.data.user.phoneNumber);
  console.log("OK — full OTP login flow works");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
