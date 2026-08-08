import ScreenClient from "./ScreenClient";
import WrongAddressGuard from "../WrongAddressGuard";

export const dynamic = "force-dynamic";

export default function ScreenPage() {
  return (
    <>
      <WrongAddressGuard />
      <ScreenClient />
    </>
  );
}
