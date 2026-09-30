"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { currentMonth } from "../../lib/activity-month";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function monthDate(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1);
}

function dateMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const monthLabel = (date: Date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

export function MonthPicker({ value, onValueChange, disabled }: { value: string; onValueChange: (month: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(() => monthDate(value === "all" ? currentMonth() : value));
  function chooseMonth(date: Date) {
    onValueChange(dateMonth(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) setDisplayedMonth(monthDate(value === "all" ? currentMonth() : value));
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button id="activity-month" type="button" variant="outline" disabled={disabled} aria-label="Choose wave month" className="justify-start font-normal">
          <CalendarIcon aria-hidden="true" />
          {value === "all" ? "Choose a month" : monthLabel(monthDate(value))}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Wave month calendar">
        <Calendar
          mode="single"
          selected={value === "all" ? undefined : monthDate(value)}
          onSelect={(date) => { if (date) chooseMonth(date); }}
          month={displayedMonth}
          onMonthChange={setDisplayedMonth}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date(2199, 11)}
          autoFocus
        />
        <div className="month-picker-footer">
          <p>Select any day to filter the whole month.</p>
          <Button type="button" variant="outline" onClick={() => chooseMonth(displayedMonth)}>Use {monthLabel(displayedMonth)}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
