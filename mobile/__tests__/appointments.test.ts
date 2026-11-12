import { canCancel, canJoinCall, doctorOrPending, isUpcoming, sortUpcoming, statusText, statusTone } from "../shared/appointments";

const doctor = { first_name: "Ada", last_name: "Obi", specialty: "Cardiology" };
const a = (status: string, extra: object = {}) => ({ status, decline_reason: null, doctors: null, ...extra });

describe("appointment status wording (same as the website)", () => {
  it("pending", () => expect(statusText(a("pending"))).toBe("Waiting for the hospital to confirm"));
  it("accepted with a doctor", () => expect(statusText(a("accepted", { doctors: doctor }))).toBe("Confirmed with Dr. Ada Obi"));
  it("confirmed with a doctor", () => expect(statusText(a("confirmed", { doctors: doctor }))).toBe("Confirmed with Dr. Ada Obi"));
  it("accepted without a doctor", () => expect(statusText(a("accepted"))).toBe("Confirmed"));
  it("rejected with a reason", () => expect(statusText(a("rejected", { decline_reason: "Doctor is away" }))).toBe("Declined: Doctor is away"));
  it("rejected without a reason", () => expect(statusText(a("rejected"))).toBe("Declined"));
  it("cancelled", () => expect(statusText(a("cancelled"))).toBe("Cancelled"));
  it("completed", () => expect(statusText(a("completed"))).toBe("Completed"));
  it("done", () => expect(statusText(a("done"))).toBe("Completed"));
  it("an unknown status is shown as it is", () => expect(statusText(a("on_hold"))).toBe("on_hold"));

  it("every status has words, so colour is never the only signal", () => {
    for (const s of ["pending", "accepted", "confirmed", "rejected", "cancelled", "completed", "done"]) {
      expect(statusText(a(s)).length).toBeGreaterThan(0);
      expect(["success", "warning", "danger", "neutral"]).toContain(statusTone(s));
    }
  });
});

describe("appointment rules", () => {
  it("names the doctor or says one will be assigned", () => {
    expect(doctorOrPending({ doctors: doctor })).toBe("Dr. Ada Obi");
    expect(doctorOrPending({ doctors: null })).toBe("Doctor to be assigned");
  });

  it("groups upcoming and past", () => {
    expect(["pending", "accepted", "confirmed"].every((s) => isUpcoming({ status: s }))).toBe(true);
    expect(["completed", "done", "cancelled", "rejected"].some((s) => isUpcoming({ status: s }))).toBe(false);
  });

  it("lets a patient cancel only pending or accepted visits", () => {
    expect(canCancel({ status: "pending" })).toBe(true);
    expect(canCancel({ status: "accepted" })).toBe(true);
    expect(canCancel({ status: "confirmed" })).toBe(false);
    expect(canCancel({ status: "completed" })).toBe(false);
  });

  it("shows Join call only for confirmed video visits", () => {
    expect(canJoinCall({ status: "accepted", is_telemedicine: true })).toBe(true);
    expect(canJoinCall({ status: "pending", is_telemedicine: true })).toBe(false);
    expect(canJoinCall({ status: "accepted", is_telemedicine: false })).toBe(false);
  });

  it("puts the soonest upcoming visit first", () => {
    const list = [
      { status: "accepted", requested_date: "2026-12-02", requested_time: "09:00" },
      { status: "cancelled", requested_date: "2026-11-20", requested_time: "09:00" },
      { status: "pending", requested_date: "2026-11-30", requested_time: "14:30" },
      { status: "pending", requested_date: "2026-11-30", requested_time: "08:00" },
    ];
    expect(sortUpcoming(list).map((x) => `${x.requested_date} ${x.requested_time}`)).toEqual(["2026-11-30 08:00", "2026-11-30 14:30", "2026-12-02 09:00"]);
  });
});
