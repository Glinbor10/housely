import { describe, expect, it } from 'vitest'
import { projectFiles } from 'archunit'

// Architecture rules: keep layers independent so the domain stays pure and testable.
describe('architecture', () => {
  it('has no circular dependencies in src', async () => {
    const violations = await projectFiles().inFolder('src/**').should().haveNoCycles().check()
    expect(violations).toEqual([])
  })

  it('keeps the domain independent from UI and storage', async () => {
    const dependsOnComponents = await projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components/**')
      .check()
    const dependsOnStorage = await projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/storage/**')
      .check()
    expect([...dependsOnComponents, ...dependsOnStorage]).toEqual([])
  })

  it('keeps components independent from storage', async () => {
    const violations = await projectFiles()
      .inFolder('src/components/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/storage/**')
      .check()
    expect(violations).toEqual([])
  })

  it('keeps storage independent from UI components', async () => {
    const violations = await projectFiles()
      .inFolder('src/storage/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components/**')
      .check()
    expect(violations).toEqual([])
  })
})
