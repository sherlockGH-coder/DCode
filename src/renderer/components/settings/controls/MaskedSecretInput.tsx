import React from 'react';

const MASKED_SECRET_LENGTH = 32;
const MASKED_SECRET_VALUE = '\u2022'.repeat(MASKED_SECRET_LENGTH);

interface MaskedSecretInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  configured: boolean;
  onValueChange: (value: string) => void;
}

export const MaskedSecretInput: React.FC<MaskedSecretInputProps> = ({
  value,
  configured,
  onValueChange,
  onFocus,
  onBlur,
  readOnly,
  ...inputProps
}) => {
  const [editing, setEditing] = React.useState(false);
  const isMasked = configured && !value && !editing;
  const displayValue = isMasked ? MASKED_SECRET_VALUE : value;

  React.useEffect(() => {
    if (!configured || !value) setEditing(false);
  }, [configured, value]);

  return (
    <input
      {...inputProps}
      value={displayValue}
      readOnly={readOnly || isMasked}
      onFocus={(event) => {
        if (isMasked) setEditing(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (!value) setEditing(false);
        onBlur?.(event);
      }}
      onChange={(event) => {
        if (!isMasked) onValueChange(event.target.value);
      }}
    />
  );
};

export default MaskedSecretInput;
