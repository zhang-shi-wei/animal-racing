import { Node, Label, Color, UITransform, Vec3, Graphics, Button, Layers } from 'cc';

export function createNode(name: string, parent: Node): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  parent.addChild(n);
  return n;
}

export function createLabel(
  parent: Node,
  text: string,
  position: Vec3,
  fontSize = 24,
  color: Color = Color.WHITE,
): Label {
  const node = createNode('label', parent);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.2);
  label.color = color;
  node.setPosition(position);
  return label;
}

export function createRect(
  parent: Node,
  width: number,
  height: number,
  color: Color,
  position: Vec3,
): Node {
  const node = createNode('rect', parent);
  const g = node.addComponent(Graphics);
  g.fillColor = color;
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();
  node.setPosition(position);
  return node;
}

export function createButton(
  parent: Node,
  text: string,
  position: Vec3,
  width: number,
  height: number,
  onClick: () => void,
): Node {
  const node = createNode('button', parent);
  const uiTransform = node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);

  const g = node.addComponent(Graphics);
  g.fillColor = new Color(80, 160, 90);
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();

  const button = node.addComponent(Button);
  button.target = node;
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.95;

  const label = createLabel(node, text, Vec3.ZERO, 28, Color.WHITE);
  label.node.setPosition(0, 0, 0);

  node.on(Button.EventType.CLICK, onClick);
  node.setPosition(position);
  return node;
}

export function createHoldButton(
  parent: Node,
  text: string,
  position: Vec3,
  width: number,
  height: number,
  onDown: () => void,
  onUp: () => void,
): Node {
  const node = createNode('holdButton', parent);
  const uiTransform = node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);

  const g = node.addComponent(Graphics);
  g.fillColor = new Color(80, 160, 90);
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();

  createLabel(node, text, Vec3.ZERO, 26, Color.WHITE);

  node.on(Node.EventType.TOUCH_START, (e) => { e.propagationStopped = true; onDown(); });
  node.on(Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; onUp(); });
  node.on(Node.EventType.TOUCH_CANCEL, (e) => { e.propagationStopped = true; onUp(); });
  node.setPosition(position);
  return node;
}
