import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";

export interface CustomSelectOption {
  value: string | number;
  label: ReactNode;
  [key: string]: unknown;
}

interface CustomSelectProps {
  value?: string | number | Array<string | number>;
  onChange?: (value: string | number | Array<string | number>) => void;
  options?: CustomSelectOption[];
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  multiple?: boolean;
  maxTagCount?: number;
}

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "请选择",
  icon = null,
  disabled = false,
  multiple = false,
  maxTagCount = 3,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value;
  }, [multiple, value]);

  const multiSelectedValues = useMemo(
    () => (Array.isArray(selectedValues) ? selectedValues : []),
    [selectedValues],
  );

  const displayLabel = useMemo(() => {
    if (multiple) {
      const labels = options
        .filter((opt) => multiSelectedValues.includes(opt.value))
        .map((opt) => opt.label);
      if (!labels.length) return placeholder;
      if (labels.length <= maxTagCount) return labels.join("、");
      const visible = labels.slice(0, maxTagCount).join("、");
      return `${visible} +${labels.length - maxTagCount}`;
    }
    const selectedOption = options.find((opt) => opt.value === selectedValues);
    return selectedOption ? selectedOption.label : placeholder;
  }, [maxTagCount, multiple, multiSelectedValues, options, placeholder, selectedValues]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        // Check if click is inside the portal dropdown
        const dropdown = document.getElementById("custom-select-dropdown");
        if (dropdown && target && dropdown.contains(target)) {
          return;
        }
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    const handleScroll = (event: Event) => {
      const dropdown = document.getElementById("custom-select-dropdown");
      const target = event.target as Node | null;
      // If scroll happens within the dropdown, ignore it
      if (dropdown && target && (target === dropdown || dropdown.contains(target))) {
        return;
      }
      setIsOpen(false);
    };

    const handleResize = () => setIsOpen(false);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: `${rect.bottom + 6}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  const toggleMultiValue = (optionValue: string | number) => {
    const exists = multiSelectedValues.includes(optionValue);
    const nextValues = exists
      ? multiSelectedValues.filter((val) => val !== optionValue)
      : [...multiSelectedValues, optionValue];
    onChange?.(nextValues);
  };

  const handleSelect = (optionValue: string | number) => {
    if (disabled) return;
    if (multiple) {
      toggleMultiValue(optionValue);
      return;
    }
    onChange?.(optionValue);
    setIsOpen(false);
  };

  return (
    <div
      className={`custom-select-container ${disabled ? "disabled" : ""} ${
        multiple ? "multi" : ""
      }`}
      ref={containerRef}
    >
      <div
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {icon && <span className="select-icon">{icon}</span>}
        <span className="select-value">{displayLabel}</span>
        <span className="select-arrow">▼</span>
      </div>
      {isOpen &&
        createPortal(
          <div
            id="custom-select-dropdown"
            className={`custom-select-options glass-card ${multiple ? "multi" : ""}`}
            style={dropdownStyle}
          >
            {options.map((option) => {
              const isSelected = multiple
                ? multiSelectedValues.includes(option.value)
                : option.value === selectedValues;
              return (
                <div
                  key={option.value}
                  className={`custom-select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {multiple && (
                    <input
                      type="checkbox"
                      readOnly
                      checked={isSelected}
                      tabIndex={-1}
                    />
                  )}
                  <span className="option-label">{option.label}</span>
                </div>
              );
            })}
            {options.length === 0 && <div className="custom-select-option muted">无选项</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
