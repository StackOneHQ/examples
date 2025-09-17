/// <reference types="react" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [elemName: string]: any;
    }
  }
  
  namespace React {
    type FC<T = {}> = import('react').FC<T>;
  }
  
  const React: {
    FC: typeof import('react').FC;
  };
}

// Fix React type compatibility issues with Ant Design
declare module 'react' {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {}
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
  }
  
  // Re-export React hooks and components
  export const useEffect: typeof import('react').useEffect;
  export const useState: typeof import('react').useState;
  export const useCallback: typeof import('react').useCallback;
  export const useRef: typeof import('react').useRef;
  export const Component: typeof import('react').Component;
  export const ReactElement: typeof import('react').ReactElement;
  export const ReactNode: typeof import('react').ReactNode;
  export const FC: typeof import('react').FC;
  
  // Re-export React types
  export type ReactNode = import('react').ReactNode;
}

// Fix Ant Design component types
declare module 'antd' {
  export interface CardInterface {
    (props: any): React.ReactElement;
  }
  
  export interface CompoundedComponent {
    (props: any): React.ReactElement;
  }
  
  export interface TagType {
    (props: any): React.ReactElement;
  }
  
  export interface ForwardRefExoticComponent<T> {
    (props: T): React.ReactElement;
  }
  
  // Export Ant Design components
  export const Button: CompoundedComponent;
  export const Card: CardInterface;
  export const Space: CompoundedComponent;
  export const Typography: {
    Text: ForwardRefExoticComponent<any>;
    Title: ForwardRefExoticComponent<any>;
    Link: ForwardRefExoticComponent<any>;
  };
  export const Tag: TagType;
  export const Tooltip: CompoundedComponent;
  export const Row: CompoundedComponent;
  export const Col: CompoundedComponent;
  export const Avatar: ForwardRefExoticComponent<any>;
  export const Checkbox: CompoundedComponent;
  export const Empty: CompoundedComponent;
  export const ConfigProvider: CompoundedComponent;
  export const theme: any;
  export const Input: CompoundedComponent & {
    TextArea: CompoundedComponent;
    Search: CompoundedComponent;
    Password: CompoundedComponent;
  };
  export const Drawer: CompoundedComponent;
  export const List: CompoundedComponent;
  export const Modal: CompoundedComponent;
  export const App: CompoundedComponent & {
    useApp: () => any;
  };
  export const Layout: CompoundedComponent & {
    Sider: CompoundedComponent;
  };
  export const Menu: CompoundedComponent;
  export const Dropdown: CompoundedComponent;
  export const Divider: CompoundedComponent;
  export const Form: CompoundedComponent & {
    Item: CompoundedComponent;
  };
  export const Alert: CompoundedComponent;
}
