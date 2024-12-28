import { assertEquals } from "@std/assert"
import { assertSnapshot } from "@std/testing/snapshot"

import { build } from "../build.tsx"

build("test/example-notes", "build")
