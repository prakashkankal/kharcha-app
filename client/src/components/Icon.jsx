import { createElement } from 'react';
import { getLucideIcon } from './iconRegistry';

export const Icon = ({ name, className = '', ...props }) => {
  return createElement(getLucideIcon(name), {
    'aria-hidden': 'true',
    className: `inline-block w-[1em] h-[1em] shrink-0 align-middle ${className}`,
    ...props,
  });
};

export const CategoryIcon = ({ name, className = '', ...props }) => (
  <Icon name={name} className={className} {...props} />
);
