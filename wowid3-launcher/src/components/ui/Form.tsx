/**
 * Compound Form Component
 *
 * Usage:
 * <Form onSubmit={handleSubmit}>
 *   <Form.Field>
 *     <Form.Label htmlFor="username">Username</Form.Label>
 *     <Form.Input id="username" name="username" required />
 *     <Form.Error>Username is required</Form.Error>
 *   </Form.Field>
 *
 *   <Form.Field>
 *     <Form.Label htmlFor="password">Password</Form.Label>
 *     <Form.Input id="password" name="password" type="password" required />
 *     <Form.Hint>Must be at least 8 characters</Form.Hint>
 *   </Form.Field>
 *
 *   <Form.Actions>
 *     <Button type="submit">Submit</Button>
 *   </Form.Actions>
 * </Form>
 */

import { FC, ReactNode, FormEvent, createContext, useContext, useState } from 'react';

interface FormContextValue {
  errors?: Record<string, string>;
  setFieldError?: (field: string, error: string) => void;
  clearFieldError?: (field: string) => void;
}

const FormContext = createContext<FormContextValue>({});

const useFormContext = () => {
  return useContext(FormContext);
};

// Main Form Component
interface FormProps {
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}

const Form: FC<FormProps> & {
  Field: FC<FormFieldProps>;
  Label: FC<FormLabelProps>;
  Input: FC<FormInputProps>;
  Select: FC<FormSelectProps>;
  Textarea: FC<FormTextareaProps>;
  Error: FC<FormErrorProps>;
  Hint: FC<FormHintProps>;
  Actions: FC<FormActionsProps>;
} = ({ onSubmit, children, className = '' }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setFieldError = (field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(e);
    }
  };

  return (
    <FormContext.Provider value={{ errors, setFieldError, clearFieldError }}>
      <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
        {children}
      </form>
    </FormContext.Provider>
  );
};

// Form Field Component (Container)
interface FormFieldProps {
  children: ReactNode;
  className?: string;
  name?: string;
}

const FormField: FC<FormFieldProps> = ({ children, className = '', name }) => {
  const { errors } = useFormContext();
  const hasError = name && errors?.[name];

  return (
    <div className={`${hasError ? 'form-field-error' : ''} ${className}`}>
      {children}
    </div>
  );
};

// Form Label Component
interface FormLabelProps {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

const FormLabel: FC<FormLabelProps> = ({ htmlFor, children, required, className = '' }) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-gray-200 mb-1 ${className}`}
    >
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
};

// Form Input Component
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const FormInput: FC<FormInputProps> = ({ error, className = '', ...props }) => {
  const { errors } = useFormContext();
  const hasError = error || (props.name && errors?.[props.name]);

  return (
    <input
      className={`
        w-full px-3 py-2
        bg-gray-800 border rounded-md
        text-white placeholder-gray-400
        focus:outline-none focus:ring-2
        transition-colors
        ${hasError
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500 focus:border-blue-500'
        }
        ${className}
      `}
      {...props}
    />
  );
};

// Form Select Component
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const FormSelect: FC<FormSelectProps> = ({ error, className = '', children, ...props }) => {
  const { errors } = useFormContext();
  const hasError = error || (props.name && errors?.[props.name]);

  return (
    <select
      className={`
        w-full px-3 py-2
        bg-gray-800 border rounded-md
        text-white
        focus:outline-none focus:ring-2
        transition-colors
        ${hasError
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500 focus:border-blue-500'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
  );
};

// Form Textarea Component
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const FormTextarea: FC<FormTextareaProps> = ({ error, className = '', ...props }) => {
  const { errors } = useFormContext();
  const hasError = error || (props.name && errors?.[props.name]);

  return (
    <textarea
      className={`
        w-full px-3 py-2
        bg-gray-800 border rounded-md
        text-white placeholder-gray-400
        focus:outline-none focus:ring-2
        transition-colors
        resize-vertical min-h-[80px]
        ${hasError
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500 focus:border-blue-500'
        }
        ${className}
      `}
      {...props}
    />
  );
};

// Form Error Component
interface FormErrorProps {
  children?: ReactNode;
  fieldName?: string;
  className?: string;
}

const FormError: FC<FormErrorProps> = ({ children, fieldName, className = '' }) => {
  const { errors } = useFormContext();
  const error = fieldName ? errors?.[fieldName] : null;
  const content = children || error;

  if (!content) return null;

  return (
    <p className={`text-sm text-red-400 mt-1 ${className}`}>
      {content}
    </p>
  );
};

// Form Hint Component
interface FormHintProps {
  children: ReactNode;
  className?: string;
}

const FormHint: FC<FormHintProps> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-gray-400 mt-1 ${className}`}>
      {children}
    </p>
  );
};

// Form Actions Component
interface FormActionsProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const FormActions: FC<FormActionsProps> = ({ children, className = '', align = 'right' }) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={`flex gap-3 mt-6 ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
};

// Attach compound components
Form.Field = FormField;
Form.Label = FormLabel;
Form.Input = FormInput;
Form.Select = FormSelect;
Form.Textarea = FormTextarea;
Form.Error = FormError;
Form.Hint = FormHint;
Form.Actions = FormActions;

export { Form };