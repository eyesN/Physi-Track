import cv2
import numpy as np

# Simple multi-object detection using grayscale + Canny + contours.
# This is rule-based (not ML training). It detects multiple objects by their edges.

def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        objects = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 400:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            objects.append((x, y, w, h, area))

        objects.sort(key=lambda item: item[4], reverse=True)

        for idx, (x, y, w, h, area) in enumerate(objects):
            color = (80, 220, 120) if idx == 0 else (180, 180, 180)
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            cx = x + w // 2
            cy = y + h // 2
            cv2.circle(frame, (cx, cy), 4, (90, 180, 255), -1)
            cv2.putText(
                frame,
                f"#{idx + 1} area={int(area)}",
                (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
                cv2.LINE_AA,
            )

        cv2.imshow("Multi-Object Detection (Grayscale + Canny)", frame)
        cv2.imshow("Edges", edges)

        key = cv2.waitKey(1) & 0xFF
        if key == 27:
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
