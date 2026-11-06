import { Suspense, lazy } from "react";
import "./styles.css";

const CompleteShelfLandingPage = lazy(() =>
  import("./effects/complete-shelf-landing-page/CompleteShelfLandingPage").then(
    (module) => ({ default: module.CompleteShelfLandingPage })
  )
);

export default function App() {
  return (
    <Suspense fallback={<div className="boot-veil" aria-hidden="true" />}>
      <div className="shader-frame">
        <CompleteShelfLandingPage
          headingFont="iowan-old-style"
          bodyFont="inter"
          primaryColor="#c87046"
        />
      </div>
    </Suspense>
  );
}
