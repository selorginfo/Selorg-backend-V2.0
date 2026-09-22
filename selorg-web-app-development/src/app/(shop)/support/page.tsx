import { redirect } from "next/navigation";

/** Legacy `/support` entry — account Help & Support hub. */
export default function SupportPage() {
  redirect("/account/help#chat");
}
