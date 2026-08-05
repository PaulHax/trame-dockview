import { getCurrentInstance } from "vue";

export default {
  props: ["params"],
  setup(props) {
    // dockview mounts each panel with Vue's standalone render(), so a panel
    // root has no parent to inherit useId() state from and restarts the
    // counter at zero. Component libraries derive DOM ids from useId(), and a
    // duplicate id makes a label[for] in one panel resolve to a control in
    // another. Panel ids are unique within a dock, so they name the namespace.
    const instance = getCurrentInstance();
    if (instance?.ids) {
      instance.ids[0] = `${props.params.api.id}-`;
    }

    const templateName = props.params.params.templateName;
    return { templateName };
  },
  template: '<trame-template :templateName="templateName" />',
};
