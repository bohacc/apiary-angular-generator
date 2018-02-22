import {gen} from './src/gen';

class TestInitClass {
  createTestContent() {
    gen();
  }
}

const testInitClass = new TestInitClass();
testInitClass.createTestContent();
