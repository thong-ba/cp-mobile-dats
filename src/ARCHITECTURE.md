## Project Architecture (src)

This document describes the current structure and architectural organization under `src/`.

### Folder Tree
```text
src/
├─ App.tsx                  # App entry mounting the navigator
├─ index.tsx                # (reserved if using custom entry; currently empty or unused)
├─ api/                     # API call layer (Axios/fetch wrappers per module)
├─ components/              # Reusable UI components grouped by app domain
│  ├─ CommonScreenComponents/
│  │  └─ HomeScreenComponents/
│  │     ├─ SearchBar.tsx
│  │     └─ index.ts
│  ├─ CustomerScreenComponents/
│  ├─ StoreOwnerScreenComponents/
│  └─ StoreStaffScreenComponents/
├─ constants/               # Fixed values (colors, dummy data, etc.)
│  ├─ color.ts
│  └─ dummyData.ts
├─ hooks/                   # Custom hooks (e.g., useAuth, useTheme)
├─ navigation/              # App navigators, route configs
│  └─ AppNavigator.tsx
├─ screens/                 # Feature screens grouped by flows
│  ├─ CommonScreens/
│  │  └─ ComonHomeScreen/
│  │     ├─ HomeScreen.tsx
│  │     └─ index.ts
│  ├─ CustomerScreens/
│  ├─ StoreOwnerScreens/
│  └─ StoreStaffScreens/
├─ services/                # Business logic services (AuthService, OrderService, ...)
└─ utils/                   # Utility helpers (formatting, validation, etc.)
```

### Roles and Conventions
- **App.tsx**: Entry point under `src/`. Renders the root navigator.
- **navigation/**: Holds navigators and navigation configuration.
  - `AppNavigator.tsx` sets up a native stack with `Home` as the initial screen.
- **screens/**: Each user flow has its own folder. Each screen can be a subfolder with its own `index.ts` barrel.
  - Current registered screen: `HomeScreen` in `CommonScreens/ComonHomeScreen`.
- **components/**:
  - Grouped by screen domain for now; can be extended with `common/` (Button, Card, Modal, etc.) and `layout/` (Header, Footer) if needed.
  - Example present: `HomeScreenComponents/SearchBar.tsx`.
- **constants/**: Centralizes UI/system constants such as `COLORS` and `dummyData` used by the home screen.
- **api/**: Placeholder for HTTP layer per module (recommend Axios instance with interceptors and typed clients).
- **services/**: Place to house business logic orchestration (AuthService, OrderService). Should call into `api/` and be used by screens/hooks.
- **hooks/**: Custom React hooks for shared logic (e.g., `useAuth`, `useTheme`, `usePaginatedList`).
- **utils/**: Stateless helpers for formatting, parsing, validation, etc.

### Current Wiring
- `src/App.tsx` mounts the app navigator:
```startLine:endLine:src/App.tsx
import React from 'react';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}
```

- `src/navigation/AppNavigator.tsx` defines a stack navigator with `Home` screen:
```startLine:endLine:src/navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../screens/CommonScreens/ComonHomeScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- `src/screens/CommonScreens/ComonHomeScreen/HomeScreen.tsx` composes UI from constants and components:
```startLine:endLine:src/screens/CommonScreens/ComonHomeScreen/HomeScreen.tsx
import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import BannerCarousel from '../../../components/CommonScreenComponents/HomeScreenComponents/BannerCarousel';
import CategoryCard from '../../../components/CommonScreenComponents/HomeScreenComponents/CategoryCard';
import ProductCard from '../../../components/CommonScreenComponents/HomeScreenComponents/ProductCard';
import SearchBar from '../../../components/CommonScreenComponents/HomeScreenComponents/SearchBar';
import { COLORS } from '../../../constants/color';
import { banners, categories, products } from '../../../constants/dummyData';

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <SearchBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        <BannerCarousel banners={banners} />
        {/* ... */}
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
```

### Next Steps (Recommended)
- Add an HTTP client in `api/` (Axios instance + interceptors, error normalization).
- Introduce `services/` modules (e.g., `AuthService`) that use `api/` and expose business operations.
- Expand `components/` with `common/` and `layout/` for shared UI primitives.
- Define route name constants and navigation types.
- Populate `hooks/` with cross-cutting hooks (`useAuth`, `useTheme`).
- Fill `utils/` with formatting/validation helpers (currency, date, email).
