import { Input } from "@/components/ui/Input";
import type { ReceiverInfo } from "@/types";

export function ReceiverForm({
  receiver,
  setField,
}: {
  receiver: ReceiverInfo;
  setField: (field: keyof ReceiverInfo, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input
        label="Receiver name (optional)"
        value={receiver.name}
        onChange={(e) => setField("name", e.target.value)}
      />
      <Input
        label="Receiver phone (optional)"
        value={receiver.phone}
        onChange={(e) => setField("phone", e.target.value)}
      />
      <div className="sm:col-span-2">
        <Input
          label="Delivery note (optional)"
          value={receiver.note}
          onChange={(e) => setField("note", e.target.value)}
          placeholder="e.g. Leave at the door"
        />
      </div>
    </div>
  );
}
