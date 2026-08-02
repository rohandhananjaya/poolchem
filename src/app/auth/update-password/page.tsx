import type { Metadata } from "next";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Set New Password | Poolbench",
  description:
    "Choose a new password for your Poolbench account.",
};

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
